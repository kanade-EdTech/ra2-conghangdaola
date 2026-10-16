"""Read-only Westwood MIX / SHP-TS / PAL decoding for local asset collection.

Binary layouts checked against the OpenRA format readers. Independent Python
implementation; uses the existing Python OpenSSL DLL rather than bundling crypto.
"""
import base64
import ctypes
import mmap
import struct
import sys
import zlib
from pathlib import Path
from PIL import Image


def mix_hash(name):
    text = name.upper().encode('ascii')
    tail = len(text) % 4
    if tail:
        text += bytes([tail]) + text[len(text) - tail:len(text) - tail + 1] * (3 - tail)
    return zlib.crc32(text) & 0xffffffff


class Blowfish:
    def __init__(self, block):
        modulus = int.from_bytes(base64.b64decode(
            'AihRvNoIbTn85FZRYNZRcT+i6KpU+maCsEqr3Q5q+LDB5tH7Tz2qQ38V')[2:], 'big')
        width = (modulus.bit_length() - 2) // 8
        key = b''.join(pow(int.from_bytes(block[i:i + width + 1], 'little'), 65537, modulus)
                       .to_bytes(width + 1, 'little')[:width]
                       for i in range(0, len(block), width + 1))[:56]
        self.lib = ctypes.CDLL(str(Path(sys.prefix) / 'DLLs/libcrypto-3.dll'))
        self.schedule = (ctypes.c_uint32 * 1042)()
        self.lib.BF_set_key.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
        self.lib.BF_ecb_encrypt.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        self.lib.BF_set_key(self.schedule, len(key), key)

    def decrypt(self, data):
        result = bytearray()
        for i in range(0, len(data), 8):
            output = ctypes.create_string_buffer(8)
            self.lib.BF_ecb_encrypt(bytes(data[i:i + 8]), output, self.schedule, 0)
            result.extend(output.raw)
        return bytes(result)


class Mix:
    def __init__(self, data, source):
        self.data, self.source = data, source
        offset = 0 if struct.unpack_from('<H', data)[0] else 4
        flags = struct.unpack_from('<I', data)[0] if offset else 0
        if flags & 0x20000:
            fish = Blowfish(bytes(data[4:84]))
            count = struct.unpack_from('<H', fish.decrypt(data[84:92]))[0]
            padded = ((6 + count * 12 + 7) // 8) * 8
            header = fish.decrypt(data[84:84 + padded])
            self.start = 84 + padded
        else:
            count = struct.unpack_from('<H', data, offset)[0]
            header = data[offset:offset + 6 + 12 * count]
            self.start = offset + 6 + 12 * count
        size = struct.unpack_from('<I', header, 2)[0]
        if self.start + size > len(data):
            raise ValueError('MIX data exceeds archive: ' + source)
        self.entries = {}
        for i in range(count):
            key, position, length = struct.unpack_from('<III', header, 6 + i * 12)
            if position + length > size:
                raise ValueError('MIX entry exceeds data: ' + source)
            self.entries[key] = (self.start + position, length)

    @classmethod
    def open(cls, path):
        with Path(path).open('rb') as stream:
            data = mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ)
        return cls(data, str(path))

    def get(self, name):
        entry = self.entries.get(mix_hash(name))
        if entry is None:
            return None
        position, length = entry
        return bytes(self.data[position:position + length])


def database(path):
    data, pos, names = Path(path).read_bytes(), 0, set()
    while pos < len(data):
        count = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        for _ in range(count):
            end = data.index(0, pos)
            names.add(data[pos:end].decode('ascii').lower())
            pos = data.index(0, end + 1) + 1
    return names


def decode_shp(data, palette, frame=0):
    marker, width, height, frames = struct.unpack_from('<4H', data)
    if marker or not 0 < frames <= 4096 or frame >= frames:
        raise ValueError('Invalid SHP header')
    if not 0 < width <= 4096 or not 0 < height <= 4096:
        raise ValueError('Invalid SHP dimensions')
    offset = 8 + 24 * frame
    x, y, w, h = struct.unpack_from('<4H', data, offset)
    compression = data[offset + 8]
    cursor = struct.unpack_from('<I', data, offset + 20)[0]
    pixels = bytearray(width * height)
    if x + w > width or y + h > height or compression > 3:
        raise ValueError('Invalid SHP frame')
    if cursor:
        for row in range(h):
            if compression == 3:
                length = struct.unpack_from('<H', data, cursor)[0]
                end, cursor = cursor + length, cursor + 2
                decoded = bytearray()
                while cursor < end:
                    value = data[cursor]; cursor += 1
                    if value:
                        decoded.append(value)
                    else:
                        run = data[cursor]; cursor += 1
                        decoded.extend(bytes(run))
                if len(decoded) != w:
                    raise ValueError('SHP scanline width mismatch')
            else:
                if compression == 2 and row == 0:
                    stride = struct.unpack_from('<H', data, cursor)[0] - 2
                    cursor += 2
                length = stride if compression == 2 else w
                decoded = data[cursor:cursor + length]
                cursor += length
                decoded = decoded[:w].ljust(w, b'\0')
            start = (y + row) * width + x
            pixels[start:start + w] = decoded
    image = Image.frombytes('P', (width, height), bytes(pixels))
    if len(palette) != 768 or max(palette) > 63:
        raise ValueError('Invalid 6-bit game palette')
    image.putpalette([component * 4 for component in palette])
    # Build-menu icons have opaque backgrounds, including palette index zero.
    return image.convert('RGB'), {'width': width, 'height': height, 'frames': frames, 'compression': compression}


def parse_ini(data):
    sections, current = {}, None
    for line in data.decode('latin1').splitlines():
        line = line.split(';', 1)[0].strip()
        if line.startswith('[') and ']' in line:
            current = sections.setdefault(line[1:line.index(']')].upper(), {})
        elif current is not None and '=' in line:
            key, value = line.split('=', 1)
            current[key.strip().upper()] = value.strip()
    return sections


def parse_csf(data):
    if data[:4] != b' FSC':
        raise ValueError('Invalid CSF')
    labels = struct.unpack_from('<I', data, 8)[0]
    cursor, result = 24, {}
    for _ in range(labels):
        if data[cursor:cursor + 4] != b' LBL':
            raise ValueError('Invalid CSF label')
        count, length = struct.unpack_from('<II', data, cursor + 4)
        cursor += 12
        name = data[cursor:cursor + length].decode('ascii').lower(); cursor += length
        for _ in range(count):
            tag = data[cursor:cursor + 4]
            length = struct.unpack_from('<I', data, cursor + 4)[0]
            cursor += 8
            result[name] = bytes(value ^ 255 for value in data[cursor:cursor + length * 2]).decode('utf-16le')
            cursor += length * 2
            if tag == b'WRTS':
                extra = struct.unpack_from('<I', data, cursor)[0]
                cursor += 4 + extra
            elif tag != b' RTS':
                raise ValueError('Invalid CSF string')
    return result
