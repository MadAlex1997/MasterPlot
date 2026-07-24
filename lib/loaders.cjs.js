'use strict';

var events = require('events');
var core = require('@loaders.gl/core');
var csv = require('@loaders.gl/csv');
var arrow = require('@loaders.gl/arrow');
var parquet = require('@loaders.gl/parquet');
var zstdCodec = require('zstd-codec');
var schema = require('@loaders.gl/schema');
var netcdf = require('@loaders.gl/netcdf');
var BitmapDataLayer_js = require('../src/plot/layers/BitmapDataLayer.js');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var lz4 = {};

var xxh32 = {};

var util = {};

var hasRequiredUtil;

function requireUtil () {
	if (hasRequiredUtil) return util;
	hasRequiredUtil = 1;
	// Simple hash function, from: http://burtleburtle.net/bob/hash/integer.html.
	// Chosen because it doesn't use multiply and achieves full avalanche.
	util.hashU32 = function hashU32 (a) {
	  a = a | 0;
	  a = a + 2127912214 + (a << 12) | 0;
	  a = a ^ -949894596 ^ a >>> 19;
	  a = a + 374761393 + (a << 5) | 0;
	  a = a + -744332180 ^ a << 9;
	  a = a + -42973499 + (a << 3) | 0;
	  return a ^ -1252372727 ^ a >>> 16 | 0;
	};

	// Reads a 64-bit little-endian integer from an array.
	util.readU64 = function readU64 (b, n) {
	  var x = 0;
	  x |= b[n++] << 0;
	  x |= b[n++] << 8;
	  x |= b[n++] << 16;
	  x |= b[n++] << 24;
	  x |= b[n++] << 32;
	  x |= b[n++] << 40;
	  x |= b[n++] << 48;
	  x |= b[n++] << 56;
	  return x;
	};

	// Reads a 32-bit little-endian integer from an array.
	util.readU32 = function readU32 (b, n) {
	  var x = 0;
	  x |= b[n++] << 0;
	  x |= b[n++] << 8;
	  x |= b[n++] << 16;
	  x |= b[n++] << 24;
	  return x;
	};

	// Writes a 32-bit little-endian integer from an array.
	util.writeU32 = function writeU32 (b, n, x) {
	  b[n++] = (x >> 0) & 0xff;
	  b[n++] = (x >> 8) & 0xff;
	  b[n++] = (x >> 16) & 0xff;
	  b[n++] = (x >> 24) & 0xff;
	};

	// Multiplies two numbers using 32-bit integer multiplication.
	// Algorithm from Emscripten.
	util.imul = function imul (a, b) {
	  var ah = a >>> 16;
	  var al = a & 65535;
	  var bh = b >>> 16;
	  var bl = b & 65535;

	  return al * bl + (ah * bl + al * bh << 16) | 0;
	};
	return util;
}

var hasRequiredXxh32;

function requireXxh32 () {
	if (hasRequiredXxh32) return xxh32;
	hasRequiredXxh32 = 1;
	// xxh32.js - implementation of xxhash32 in plain JavaScript
	var util = requireUtil();

	// xxhash32 primes
	var prime1 = 0x9e3779b1;
	var prime2 = 0x85ebca77;
	var prime3 = 0xc2b2ae3d;
	var prime4 = 0x27d4eb2f;
	var prime5 = 0x165667b1;

	// Utility functions/primitives
	// --

	function rotl32 (x, r) {
	  x = x | 0;
	  r = r | 0;

	  return x >>> (32 - r | 0) | x << r | 0;
	}

	function rotmul32 (h, r, m) {
	  h = h | 0;
	  r = r | 0;
	  m = m | 0;

	  return util.imul(h >>> (32 - r | 0) | h << r, m) | 0;
	}

	function shiftxor32 (h, s) {
	  h = h | 0;
	  s = s | 0;

	  return h >>> s ^ h | 0;
	}

	// Implementation
	// --

	function xxhapply (h, src, m0, s, m1) {
	  return rotmul32(util.imul(src, m0) + h, s, m1);
	}

	function xxh1 (h, src, index) {
	  return rotmul32((h + util.imul(src[index], prime5)), 11, prime1);
	}

	function xxh4 (h, src, index) {
	  return xxhapply(h, util.readU32(src, index), prime3, 17, prime4);
	}

	function xxh16 (h, src, index) {
	  return [
	    xxhapply(h[0], util.readU32(src, index + 0), prime2, 13, prime1),
	    xxhapply(h[1], util.readU32(src, index + 4), prime2, 13, prime1),
	    xxhapply(h[2], util.readU32(src, index + 8), prime2, 13, prime1),
	    xxhapply(h[3], util.readU32(src, index + 12), prime2, 13, prime1)
	  ];
	}

	function xxh32$1 (seed, src, index, len) {
	  var h, l;
	  l = len;
	  if (len >= 16) {
	    h = [
	      seed + prime1 + prime2,
	      seed + prime2,
	      seed,
	      seed - prime1
	    ];

	    while (len >= 16) {
	      h = xxh16(h, src, index);

	      index += 16;
	      len -= 16;
	    }

	    h = rotl32(h[0], 1) + rotl32(h[1], 7) + rotl32(h[2], 12) + rotl32(h[3], 18) + l;
	  } else {
	    h = (seed + prime5 + len) >>> 0;
	  }

	  while (len >= 4) {
	    h = xxh4(h, src, index);

	    index += 4;
	    len -= 4;
	  }

	  while (len > 0) {
	    h = xxh1(h, src, index);

	    index++;
	    len--;
	  }

	  h = shiftxor32(util.imul(shiftxor32(util.imul(shiftxor32(h, 15), prime2), 13), prime3), 16);

	  return h >>> 0;
	}

	xxh32.hash = xxh32$1;
	return xxh32;
}

var hasRequiredLz4;

function requireLz4 () {
	if (hasRequiredLz4) return lz4;
	hasRequiredLz4 = 1;
	(function (exports$1) {
		// lz4.js - An implementation of Lz4 in plain JavaScript.
		//
		// TODO:
		// - Unify header parsing/writing.
		// - Support options (block size, checksums)
		// - Support streams
		// - Better error handling (handle bad offset, etc.)
		// - HC support (better search algorithm)
		// - Tests/benchmarking

		var xxhash = requireXxh32();
		var util = requireUtil();

		// Constants
		// --

		// Compression format parameters/constants.
		var minMatch = 4;
		var minLength = 13;
		var searchLimit = 5;
		var skipTrigger = 6;
		var hashSize = 1 << 16;

		// Token constants.
		var mlBits = 4;
		var mlMask = (1 << mlBits) - 1;
		var runBits = 4;
		var runMask = (1 << runBits) - 1;

		// Shared buffers
		var blockBuf = makeBuffer(5 << 20);
		var hashTable = makeHashTable();

		// Frame constants.
		var magicNum = 0x184D2204;

		// Frame descriptor flags.
		var fdContentChksum = 0x4;
		var fdContentSize = 0x8;
		var fdBlockChksum = 0x10;
		// var fdBlockIndep = 0x20;
		var fdVersion = 0x40;
		var fdVersionMask = 0xC0;

		// Block sizes.
		var bsUncompressed = 0x80000000;
		var bsDefault = 7;
		var bsShift = 4;
		var bsMask = 7;
		var bsMap = {
		  4: 0x10000,
		  5: 0x40000,
		  6: 0x100000,
		  7: 0x400000
		};

		// Utility functions/primitives
		// --

		// Makes our hashtable. On older browsers, may return a plain array.
		function makeHashTable () {
		  try {
		    return new Uint32Array(hashSize);
		  } catch (error) {
		    var hashTable = new Array(hashSize);

		    for (var i = 0; i < hashSize; i++) {
		      hashTable[i] = 0;
		    }

		    return hashTable;
		  }
		}

		// Clear hashtable.
		function clearHashTable (table) {
		  for (var i = 0; i < hashSize; i++) {
		    hashTable[i] = 0;
		  }
		}

		// Makes a byte buffer. On older browsers, may return a plain array.
		function makeBuffer (size) {
		  try {
		    return new Uint8Array(size);
		  } catch (error) {
		    var buf = new Array(size);

		    for (var i = 0; i < size; i++) {
		      buf[i] = 0;
		    }

		    return buf;
		  }
		}

		function sliceArray (array, start, end) {
		  if (typeof array.buffer !== undefined) {
		    if (Uint8Array.prototype.slice) {
		      return array.slice(start, end);
		    } else {
		      // Uint8Array#slice polyfill.
		      var len = array.length;

		      // Calculate start.
		      start = start | 0;
		      start = (start < 0) ? Math.max(len + start, 0) : Math.min(start, len);

		      // Calculate end.
		      end = (end === undefined) ? len : end | 0;
		      end = (end < 0) ? Math.max(len + end, 0) : Math.min(end, len);

		      // Copy into new array.
		      var arraySlice = new Uint8Array(end - start);
		      for (var i = start, n = 0; i < end;) {
		        arraySlice[n++] = array[i++];
		      }

		      return arraySlice;
		    }
		  } else {
		    // Assume normal array.
		    return array.slice(start, end);
		  }
		}

		// Implementation
		// --

		// Calculates an upper bound for lz4 compression.
		exports$1.compressBound = function compressBound (n) {
		  return (n + (n / 255) + 16) | 0;
		};

		// Calculates an upper bound for lz4 decompression, by reading the data.
		exports$1.decompressBound = function decompressBound (src) {
		  var sIndex = 0;

		  // Read magic number
		  if (util.readU32(src, sIndex) !== magicNum) {
		    throw new Error('invalid magic number');
		  }

		  sIndex += 4;

		  // Read descriptor
		  var descriptor = src[sIndex++];

		  // Check version
		  if ((descriptor & fdVersionMask) !== fdVersion) {
		    throw new Error('incompatible descriptor version ' + (descriptor & fdVersionMask));
		  }

		  // Read flags
		  var useBlockSum = (descriptor & fdBlockChksum) !== 0;
		  var useContentSize = (descriptor & fdContentSize) !== 0;

		  // Read block size
		  var bsIdx = (src[sIndex++] >> bsShift) & bsMask;

		  if (bsMap[bsIdx] === undefined) {
		    throw new Error('invalid block size ' + bsIdx);
		  }

		  var maxBlockSize = bsMap[bsIdx];

		  // Get content size
		  if (useContentSize) {
		    return util.readU64(src, sIndex);
		  }

		  // Checksum
		  sIndex++;

		  // Read blocks.
		  var maxSize = 0;
		  while (true) {
		    var blockSize = util.readU32(src, sIndex);
		    sIndex += 4;

		    if (blockSize & bsUncompressed) {
		      blockSize &= ~bsUncompressed;
		      maxSize += blockSize;
		    } else {
		      maxSize += maxBlockSize;
		    }

		    if (blockSize === 0) {
		      return maxSize;
		    }

		    if (useBlockSum) {
		      sIndex += 4;
		    }

		    sIndex += blockSize;
		  }
		};

		// Creates a buffer of a given byte-size, falling back to plain arrays.
		exports$1.makeBuffer = makeBuffer;

		// Decompresses a block of Lz4.
		exports$1.decompressBlock = function decompressBlock (src, dst, sIndex, sLength, dIndex) {
		  var mLength, mOffset, sEnd, n, i;

		  // Setup initial state.
		  sEnd = sIndex + sLength;

		  // Consume entire input block.
		  while (sIndex < sEnd) {
		    var token = src[sIndex++];

		    // Copy literals.
		    var literalCount = (token >> 4);
		    if (literalCount > 0) {
		      // Parse length.
		      if (literalCount === 0xf) {
		        while (true) {
		          literalCount += src[sIndex];
		          if (src[sIndex++] !== 0xff) {
		            break;
		          }
		        }
		      }

		      // Copy literals
		      for (n = sIndex + literalCount; sIndex < n;) {
		        dst[dIndex++] = src[sIndex++];
		      }
		    }

		    if (sIndex >= sEnd) {
		      break;
		    }

		    // Copy match.
		    mLength = (token & 0xf);

		    // Parse offset.
		    mOffset = src[sIndex++] | (src[sIndex++] << 8);

		    // Parse length.
		    if (mLength === 0xf) {
		      while (true) {
		        mLength += src[sIndex];
		        if (src[sIndex++] !== 0xff) {
		          break;
		        }
		      }
		    }

		    mLength += minMatch;

		    // Copy match.
		    for (i = dIndex - mOffset, n = i + mLength; i < n;) {
		      dst[dIndex++] = dst[i++] | 0;
		    }
		  }

		  return dIndex;
		};

		// Compresses a block with Lz4.
		exports$1.compressBlock = function compressBlock (src, dst, sIndex, sLength, hashTable) {
		  var mIndex, mAnchor, mLength, mOffset, mStep;
		  var literalCount, dIndex, sEnd, n;

		  // Setup initial state.
		  dIndex = 0;
		  sEnd = sLength + sIndex;
		  mAnchor = sIndex;

		  // Process only if block is large enough.
		  if (sLength >= minLength) {
		    var searchMatchCount = (1 << skipTrigger) + 3;

		    // Consume until last n literals (Lz4 spec limitation.)
		    while (sIndex + minMatch < sEnd - searchLimit) {
		      var seq = util.readU32(src, sIndex);
		      var hash = util.hashU32(seq) >>> 0;

		      // Crush hash to 16 bits.
		      hash = ((hash >> 16) ^ hash) >>> 0 & 0xffff;

		      // Look for a match in the hashtable. NOTE: remove one; see below.
		      mIndex = hashTable[hash] - 1;

		      // Put pos in hash table. NOTE: add one so that zero = invalid.
		      hashTable[hash] = sIndex + 1;

		      // Determine if there is a match (within range.)
		      if (mIndex < 0 || ((sIndex - mIndex) >>> 16) > 0 || util.readU32(src, mIndex) !== seq) {
		        mStep = searchMatchCount++ >> skipTrigger;
		        sIndex += mStep;
		        continue;
		      }

		      searchMatchCount = (1 << skipTrigger) + 3;

		      // Calculate literal count and offset.
		      literalCount = sIndex - mAnchor;
		      mOffset = sIndex - mIndex;

		      // We've already matched one word, so get that out of the way.
		      sIndex += minMatch;
		      mIndex += minMatch;

		      // Determine match length.
		      // N.B.: mLength does not include minMatch, Lz4 adds it back
		      // in decoding.
		      mLength = sIndex;
		      while (sIndex < sEnd - searchLimit && src[sIndex] === src[mIndex]) {
		        sIndex++;
		        mIndex++;
		      }
		      mLength = sIndex - mLength;

		      // Write token + literal count.
		      var token = mLength < mlMask ? mLength : mlMask;
		      if (literalCount >= runMask) {
		        dst[dIndex++] = (runMask << mlBits) + token;
		        for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
		          dst[dIndex++] = 0xff;
		        }
		        dst[dIndex++] = n;
		      } else {
		        dst[dIndex++] = (literalCount << mlBits) + token;
		      }

		      // Write literals.
		      for (var i = 0; i < literalCount; i++) {
		        dst[dIndex++] = src[mAnchor + i];
		      }

		      // Write offset.
		      dst[dIndex++] = mOffset;
		      dst[dIndex++] = (mOffset >> 8);

		      // Write match length.
		      if (mLength >= mlMask) {
		        for (n = mLength - mlMask; n >= 0xff; n -= 0xff) {
		          dst[dIndex++] = 0xff;
		        }
		        dst[dIndex++] = n;
		      }

		      // Move the anchor.
		      mAnchor = sIndex;
		    }
		  }

		  // Nothing was encoded.
		  if (mAnchor === 0) {
		    return 0;
		  }

		  // Write remaining literals.
		  // Write literal token+count.
		  literalCount = sEnd - mAnchor;
		  if (literalCount >= runMask) {
		    dst[dIndex++] = (runMask << mlBits);
		    for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
		      dst[dIndex++] = 0xff;
		    }
		    dst[dIndex++] = n;
		  } else {
		    dst[dIndex++] = (literalCount << mlBits);
		  }

		  // Write literals.
		  sIndex = mAnchor;
		  while (sIndex < sEnd) {
		    dst[dIndex++] = src[sIndex++];
		  }

		  return dIndex;
		};

		// Decompresses a frame of Lz4 data.
		exports$1.decompressFrame = function decompressFrame (src, dst) {
		  var useBlockSum, useContentSum, useContentSize, descriptor;
		  var sIndex = 0;
		  var dIndex = 0;

		  // Read magic number
		  if (util.readU32(src, sIndex) !== magicNum) {
		    throw new Error('invalid magic number');
		  }

		  sIndex += 4;

		  // Read descriptor
		  descriptor = src[sIndex++];

		  // Check version
		  if ((descriptor & fdVersionMask) !== fdVersion) {
		    throw new Error('incompatible descriptor version');
		  }

		  // Read flags
		  useBlockSum = (descriptor & fdBlockChksum) !== 0;
		  useContentSum = (descriptor & fdContentChksum) !== 0;
		  useContentSize = (descriptor & fdContentSize) !== 0;

		  // Read block size
		  var bsIdx = (src[sIndex++] >> bsShift) & bsMask;

		  if (bsMap[bsIdx] === undefined) {
		    throw new Error('invalid block size');
		  }

		  if (useContentSize) {
		    // TODO: read content size
		    sIndex += 8;
		  }

		  sIndex++;

		  // Read blocks.
		  while (true) {
		    var compSize;

		    compSize = util.readU32(src, sIndex);
		    sIndex += 4;

		    if (compSize === 0) {
		      break;
		    }

		    if (useBlockSum) {
		      // TODO: read block checksum
		      sIndex += 4;
		    }

		    // Check if block is compressed
		    if ((compSize & bsUncompressed) !== 0) {
		      // Mask off the 'uncompressed' bit
		      compSize &= ~bsUncompressed;

		      // Copy uncompressed data into destination buffer.
		      for (var j = 0; j < compSize; j++) {
		        dst[dIndex++] = src[sIndex++];
		      }
		    } else {
		      // Decompress into blockBuf
		      dIndex = exports$1.decompressBlock(src, dst, sIndex, compSize, dIndex);
		      sIndex += compSize;
		    }
		  }

		  if (useContentSum) {
		    // TODO: read content checksum
		    sIndex += 4;
		  }

		  return dIndex;
		};

		// Compresses data to an Lz4 frame.
		exports$1.compressFrame = function compressFrame (src, dst) {
		  var dIndex = 0;

		  // Write magic number.
		  util.writeU32(dst, dIndex, magicNum);
		  dIndex += 4;

		  // Descriptor flags.
		  dst[dIndex++] = fdVersion;
		  dst[dIndex++] = bsDefault << bsShift;

		  // Descriptor checksum.
		  dst[dIndex] = xxhash.hash(0, dst, 4, dIndex - 4) >> 8;
		  dIndex++;

		  // Write blocks.
		  var maxBlockSize = bsMap[bsDefault];
		  var remaining = src.length;
		  var sIndex = 0;

		  // Clear the hashtable.
		  clearHashTable();

		  // Split input into blocks and write.
		  while (remaining > 0) {
		    var compSize = 0;
		    var blockSize = remaining > maxBlockSize ? maxBlockSize : remaining;

		    compSize = exports$1.compressBlock(src, blockBuf, sIndex, blockSize, hashTable);

		    if (compSize > blockSize || compSize === 0) {
		      // Output uncompressed.
		      util.writeU32(dst, dIndex, 0x80000000 | blockSize);
		      dIndex += 4;

		      for (var z = sIndex + blockSize; sIndex < z;) {
		        dst[dIndex++] = src[sIndex++];
		      }

		      remaining -= blockSize;
		    } else {
		      // Output compressed.
		      util.writeU32(dst, dIndex, compSize);
		      dIndex += 4;

		      for (var j = 0; j < compSize;) {
		        dst[dIndex++] = blockBuf[j++];
		      }

		      sIndex += blockSize;
		      remaining -= blockSize;
		    }
		  }

		  // Write blank end block.
		  util.writeU32(dst, dIndex, 0);
		  dIndex += 4;

		  return dIndex;
		};

		// Decompresses a buffer containing an Lz4 frame. maxSize is optional; if not
		// provided, a maximum size will be determined by examining the data. The
		// buffer returned will always be perfectly-sized.
		exports$1.decompress = function decompress (src, maxSize) {
		  var dst, size;

		  if (maxSize === undefined) {
		    maxSize = exports$1.decompressBound(src);
		  }

		  dst = exports$1.makeBuffer(maxSize);
		  size = exports$1.decompressFrame(src, dst);

		  if (size !== maxSize) {
		    dst = sliceArray(dst, 0, size);
		  }

		  return dst;
		};

		// Compresses a buffer to an Lz4 frame. maxSize is optional; if not provided,
		// a buffer will be created based on the theoretical worst output size for a
		// given input size. The buffer returned will always be perfectly-sized.
		exports$1.compress = function compress (src, maxSize) {
		  var dst, size;

		  if (maxSize === undefined) {
		    maxSize = exports$1.compressBound(src.length);
		  }

		  dst = exports$1.makeBuffer(maxSize);
		  size = exports$1.compressFrame(src, dst);

		  if (size !== maxSize) {
		    dst = sliceArray(dst, 0, size);
		  }

		  return dst;
		}; 
	} (lz4));
	return lz4;
}

var lz4Exports = requireLz4();
var lz4js = /*@__PURE__*/getDefaultExportFromCjs(lz4Exports);

var snappyjs = {};

var snappy_decompressor = {};

var hasRequiredSnappy_decompressor;

function requireSnappy_decompressor () {
	if (hasRequiredSnappy_decompressor) return snappy_decompressor;
	hasRequiredSnappy_decompressor = 1;

	var WORD_MASK = [0, 0xff, 0xffff, 0xffffff, 0xffffffff];

	function copyBytes (fromArray, fromPos, toArray, toPos, length) {
	  var i;
	  for (i = 0; i < length; i++) {
	    toArray[toPos + i] = fromArray[fromPos + i];
	  }
	}

	function selfCopyBytes (array, pos, offset, length) {
	  var i;
	  for (i = 0; i < length; i++) {
	    array[pos + i] = array[pos - offset + i];
	  }
	}

	function SnappyDecompressor (compressed) {
	  this.array = compressed;
	  this.pos = 0;
	}

	SnappyDecompressor.prototype.readUncompressedLength = function () {
	  var result = 0;
	  var shift = 0;
	  var c, val;
	  while (shift < 32 && this.pos < this.array.length) {
	    c = this.array[this.pos];
	    this.pos += 1;
	    val = c & 0x7f;
	    if (((val << shift) >>> shift) !== val) {
	      return -1
	    }
	    result |= val << shift;
	    if (c < 128) {
	      return result
	    }
	    shift += 7;
	  }
	  return -1
	};

	SnappyDecompressor.prototype.uncompressToBuffer = function (outBuffer) {
	  var array = this.array;
	  var arrayLength = array.length;
	  var pos = this.pos;
	  var outPos = 0;

	  var c, len, smallLen;
	  var offset;

	  while (pos < array.length) {
	    c = array[pos];
	    pos += 1;
	    if ((c & 0x3) === 0) {
	      // Literal
	      len = (c >>> 2) + 1;
	      if (len > 60) {
	        if (pos + 3 >= arrayLength) {
	          return false
	        }
	        smallLen = len - 60;
	        len = array[pos] + (array[pos + 1] << 8) + (array[pos + 2] << 16) + (array[pos + 3] << 24);
	        len = (len & WORD_MASK[smallLen]) + 1;
	        pos += smallLen;
	      }
	      if (pos + len > arrayLength) {
	        return false
	      }
	      copyBytes(array, pos, outBuffer, outPos, len);
	      pos += len;
	      outPos += len;
	    } else {
	      switch (c & 0x3) {
	        case 1:
	          len = ((c >>> 2) & 0x7) + 4;
	          offset = array[pos] + ((c >>> 5) << 8);
	          pos += 1;
	          break
	        case 2:
	          if (pos + 1 >= arrayLength) {
	            return false
	          }
	          len = (c >>> 2) + 1;
	          offset = array[pos] + (array[pos + 1] << 8);
	          pos += 2;
	          break
	        case 3:
	          if (pos + 3 >= arrayLength) {
	            return false
	          }
	          len = (c >>> 2) + 1;
	          offset = array[pos] + (array[pos + 1] << 8) + (array[pos + 2] << 16) + (array[pos + 3] << 24);
	          pos += 4;
	          break
	      }
	      if (offset === 0 || offset > outPos) {
	        return false
	      }
	      selfCopyBytes(outBuffer, outPos, offset, len);
	      outPos += len;
	    }
	  }
	  return true
	};

	snappy_decompressor.SnappyDecompressor = SnappyDecompressor;
	return snappy_decompressor;
}

var snappy_compressor = {};

var hasRequiredSnappy_compressor;

function requireSnappy_compressor () {
	if (hasRequiredSnappy_compressor) return snappy_compressor;
	hasRequiredSnappy_compressor = 1;

	var BLOCK_LOG = 16;
	var BLOCK_SIZE = 1 << BLOCK_LOG;

	var MAX_HASH_TABLE_BITS = 14;
	var globalHashTables = new Array(MAX_HASH_TABLE_BITS + 1);

	function hashFunc (key, hashFuncShift) {
	  return (key * 0x1e35a7bd) >>> hashFuncShift
	}

	function load32 (array, pos) {
	  return array[pos] + (array[pos + 1] << 8) + (array[pos + 2] << 16) + (array[pos + 3] << 24)
	}

	function equals32 (array, pos1, pos2) {
	  return array[pos1] === array[pos2] &&
	         array[pos1 + 1] === array[pos2 + 1] &&
	         array[pos1 + 2] === array[pos2 + 2] &&
	         array[pos1 + 3] === array[pos2 + 3]
	}

	function copyBytes (fromArray, fromPos, toArray, toPos, length) {
	  var i;
	  for (i = 0; i < length; i++) {
	    toArray[toPos + i] = fromArray[fromPos + i];
	  }
	}

	function emitLiteral (input, ip, len, output, op) {
	  if (len <= 60) {
	    output[op] = (len - 1) << 2;
	    op += 1;
	  } else if (len < 256) {
	    output[op] = 60 << 2;
	    output[op + 1] = len - 1;
	    op += 2;
	  } else {
	    output[op] = 61 << 2;
	    output[op + 1] = (len - 1) & 0xff;
	    output[op + 2] = (len - 1) >>> 8;
	    op += 3;
	  }
	  copyBytes(input, ip, output, op, len);
	  return op + len
	}

	function emitCopyLessThan64 (output, op, offset, len) {
	  if (len < 12 && offset < 2048) {
	    output[op] = 1 + ((len - 4) << 2) + ((offset >>> 8) << 5);
	    output[op + 1] = offset & 0xff;
	    return op + 2
	  } else {
	    output[op] = 2 + ((len - 1) << 2);
	    output[op + 1] = offset & 0xff;
	    output[op + 2] = offset >>> 8;
	    return op + 3
	  }
	}

	function emitCopy (output, op, offset, len) {
	  while (len >= 68) {
	    op = emitCopyLessThan64(output, op, offset, 64);
	    len -= 64;
	  }
	  if (len > 64) {
	    op = emitCopyLessThan64(output, op, offset, 60);
	    len -= 60;
	  }
	  return emitCopyLessThan64(output, op, offset, len)
	}

	function compressFragment (input, ip, inputSize, output, op) {
	  var hashTableBits = 1;
	  while ((1 << hashTableBits) <= inputSize &&
	         hashTableBits <= MAX_HASH_TABLE_BITS) {
	    hashTableBits += 1;
	  }
	  hashTableBits -= 1;
	  var hashFuncShift = 32 - hashTableBits;

	  if (typeof globalHashTables[hashTableBits] === 'undefined') {
	    globalHashTables[hashTableBits] = new Uint16Array(1 << hashTableBits);
	  }
	  var hashTable = globalHashTables[hashTableBits];
	  var i;
	  for (i = 0; i < hashTable.length; i++) {
	    hashTable[i] = 0;
	  }

	  var ipEnd = ip + inputSize;
	  var ipLimit;
	  var baseIp = ip;
	  var nextEmit = ip;

	  var hash, nextHash;
	  var nextIp, candidate, skip;
	  var bytesBetweenHashLookups;
	  var base, matched, offset;
	  var prevHash, curHash;
	  var flag = true;

	  var INPUT_MARGIN = 15;
	  if (inputSize >= INPUT_MARGIN) {
	    ipLimit = ipEnd - INPUT_MARGIN;

	    ip += 1;
	    nextHash = hashFunc(load32(input, ip), hashFuncShift);

	    while (flag) {
	      skip = 32;
	      nextIp = ip;
	      do {
	        ip = nextIp;
	        hash = nextHash;
	        bytesBetweenHashLookups = skip >>> 5;
	        skip += 1;
	        nextIp = ip + bytesBetweenHashLookups;
	        if (ip > ipLimit) {
	          flag = false;
	          break
	        }
	        nextHash = hashFunc(load32(input, nextIp), hashFuncShift);
	        candidate = baseIp + hashTable[hash];
	        hashTable[hash] = ip - baseIp;
	      } while (!equals32(input, ip, candidate))

	      if (!flag) {
	        break
	      }

	      op = emitLiteral(input, nextEmit, ip - nextEmit, output, op);

	      do {
	        base = ip;
	        matched = 4;
	        while (ip + matched < ipEnd && input[ip + matched] === input[candidate + matched]) {
	          matched += 1;
	        }
	        ip += matched;
	        offset = base - candidate;
	        op = emitCopy(output, op, offset, matched);

	        nextEmit = ip;
	        if (ip >= ipLimit) {
	          flag = false;
	          break
	        }
	        prevHash = hashFunc(load32(input, ip - 1), hashFuncShift);
	        hashTable[prevHash] = ip - 1 - baseIp;
	        curHash = hashFunc(load32(input, ip), hashFuncShift);
	        candidate = baseIp + hashTable[curHash];
	        hashTable[curHash] = ip - baseIp;
	      } while (equals32(input, ip, candidate))

	      if (!flag) {
	        break
	      }

	      ip += 1;
	      nextHash = hashFunc(load32(input, ip), hashFuncShift);
	    }
	  }

	  if (nextEmit < ipEnd) {
	    op = emitLiteral(input, nextEmit, ipEnd - nextEmit, output, op);
	  }

	  return op
	}

	function putVarint (value, output, op) {
	  do {
	    output[op] = value & 0x7f;
	    value = value >>> 7;
	    if (value > 0) {
	      output[op] += 0x80;
	    }
	    op += 1;
	  } while (value > 0)
	  return op
	}

	function SnappyCompressor (uncompressed) {
	  this.array = uncompressed;
	}

	SnappyCompressor.prototype.maxCompressedLength = function () {
	  var sourceLen = this.array.length;
	  return 32 + sourceLen + Math.floor(sourceLen / 6)
	};

	SnappyCompressor.prototype.compressToBuffer = function (outBuffer) {
	  var array = this.array;
	  var length = array.length;
	  var pos = 0;
	  var outPos = 0;

	  var fragmentSize;

	  outPos = putVarint(length, outBuffer, outPos);
	  while (pos < length) {
	    fragmentSize = Math.min(length - pos, BLOCK_SIZE);
	    outPos = compressFragment(array, pos, fragmentSize, outBuffer, outPos);
	    pos += fragmentSize;
	  }

	  return outPos
	};

	snappy_compressor.SnappyCompressor = SnappyCompressor;
	return snappy_compressor;
}

var hasRequiredSnappyjs;

function requireSnappyjs () {
	if (hasRequiredSnappyjs) return snappyjs;
	hasRequiredSnappyjs = 1;

	function isNode () {
	  if (typeof process === 'object') {
	    if (typeof process.versions === 'object') {
	      if (typeof process.versions.node !== 'undefined') {
	        return true
	      }
	    }
	  }
	  return false
	}

	function isUint8Array (object) {
	  return object instanceof Uint8Array && (!isNode() || !Buffer.isBuffer(object))
	}

	function isArrayBuffer (object) {
	  return object instanceof ArrayBuffer
	}

	function isBuffer (object) {
	  if (!isNode()) {
	    return false
	  }
	  return Buffer.isBuffer(object)
	}

	var SnappyDecompressor = requireSnappy_decompressor().SnappyDecompressor;
	var SnappyCompressor = requireSnappy_compressor().SnappyCompressor;

	var TYPE_ERROR_MSG = 'Argument compressed must be type of ArrayBuffer, Buffer, or Uint8Array';

	function uncompress (compressed, maxLength) {
	  if (!isUint8Array(compressed) && !isArrayBuffer(compressed) && !isBuffer(compressed)) {
	    throw new TypeError(TYPE_ERROR_MSG)
	  }
	  var uint8Mode = false;
	  var arrayBufferMode = false;
	  if (isUint8Array(compressed)) {
	    uint8Mode = true;
	  } else if (isArrayBuffer(compressed)) {
	    arrayBufferMode = true;
	    compressed = new Uint8Array(compressed);
	  }
	  var decompressor = new SnappyDecompressor(compressed);
	  var length = decompressor.readUncompressedLength();
	  if (length === -1) {
	    throw new Error('Invalid Snappy bitstream')
	  }
	  if (length > maxLength) {
	    throw new Error(`The uncompressed length of ${length} is too big, expect at most ${maxLength}`)
	  }
	  var uncompressed, uncompressedView;
	  if (uint8Mode) {
	    uncompressed = new Uint8Array(length);
	    if (!decompressor.uncompressToBuffer(uncompressed)) {
	      throw new Error('Invalid Snappy bitstream')
	    }
	  } else if (arrayBufferMode) {
	    uncompressed = new ArrayBuffer(length);
	    uncompressedView = new Uint8Array(uncompressed);
	    if (!decompressor.uncompressToBuffer(uncompressedView)) {
	      throw new Error('Invalid Snappy bitstream')
	    }
	  } else {
	    uncompressed = Buffer.alloc(length);
	    if (!decompressor.uncompressToBuffer(uncompressed)) {
	      throw new Error('Invalid Snappy bitstream')
	    }
	  }
	  return uncompressed
	}

	function compress (uncompressed) {
	  if (!isUint8Array(uncompressed) && !isArrayBuffer(uncompressed) && !isBuffer(uncompressed)) {
	    throw new TypeError(TYPE_ERROR_MSG)
	  }
	  var uint8Mode = false;
	  var arrayBufferMode = false;
	  if (isUint8Array(uncompressed)) {
	    uint8Mode = true;
	  } else if (isArrayBuffer(uncompressed)) {
	    arrayBufferMode = true;
	    uncompressed = new Uint8Array(uncompressed);
	  }
	  var compressor = new SnappyCompressor(uncompressed);
	  var maxLength = compressor.maxCompressedLength();
	  var compressed, compressedView;
	  var length;
	  if (uint8Mode) {
	    compressed = new Uint8Array(maxLength);
	    length = compressor.compressToBuffer(compressed);
	  } else if (arrayBufferMode) {
	    compressed = new ArrayBuffer(maxLength);
	    compressedView = new Uint8Array(compressed);
	    length = compressor.compressToBuffer(compressedView);
	  } else {
	    compressed = Buffer.alloc(maxLength);
	    length = compressor.compressToBuffer(compressed);
	  }
	  if (!compressed.slice) { // ie11
	    var compressedArray = new Uint8Array(Array.prototype.slice.call(compressed, 0, length));
	    if (uint8Mode) {
	      return compressedArray
	    } else if (arrayBufferMode) {
	      return compressedArray.buffer
	    } else {
	      throw new Error('Not implemented')
	    }
	  }

	  return compressed.slice(0, length)
	}

	snappyjs.uncompress = uncompress;
	snappyjs.compress = compress;
	return snappyjs;
}

var snappyjsExports = requireSnappyjs();
var snappy = /*@__PURE__*/getDefaultExportFromCjs(snappyjsExports);

/**
 * TableLoaderAdapter — F32
 *
 * Loads CSV, TSV, Apache Arrow (.arrow), or Parquet (.parquet) files and
 * streams the parsed rows into a MasterPlot DataStore as typed-array bufferStructs.
 *
 * Uses @loaders.gl/schema table accessors as the sole data-access API:
 *   getTableLength     — number of rows
 *   getTableNumCols    — number of columns
 *   getTableColumnName — column name by index
 *   getTableCell       — single cell value by row index + column name
 *
 * Supported loaders:
 *   .csv / .tsv  → @loaders.gl/csv   CSVLoader    (object-row-table)
 *   .arrow       → @loaders.gl/arrow ArrowLoader  (arrow-table)
 *   .parquet     → @loaders.gl/parquet ParquetLoader (object-row-table)
 *
 * Events: 'loaded' { rowCount, columns }, 'chunk' { loaded, total },
 *         'parseWarning' { message }
 */

class TableLoaderAdapter extends events.EventEmitter {
  /**
   * @param {import('../src/plot/DataStore.js').DataStore} dataStore
   * @param {object} opts
   * @param {string}               opts.x          — column name for X axis (required)
   * @param {string}               opts.y          — column name for Y axis (required)
   * @param {string|number|null}  [opts.size]      — column name, fixed number, or null (default 4.0)
   * @param {string|Function|null}[opts.color]     — column name, fn(value)→[r,g,b,a], or null
   * @param {number}              [opts.chunkSize] — rows per appendData call (default 50_000)
   * @param {boolean}             [opts.replace]   — clear DataStore before loading (default false)
   */
  constructor(dataStore, opts = {}) {
    super();
    if (!dataStore) throw new Error('TableLoaderAdapter: dataStore is required');
    if (!opts.x || !opts.y) throw new Error('TableLoaderAdapter: opts.x and opts.y are required');
    this._dataStore = dataStore;
    this._xCol = opts.x;
    this._yCol = opts.y;
    this._sizeOpt = opts.size ?? 4.0;
    this._colorOpt = opts.color ?? null;
    this._chunkSize = opts.chunkSize ?? 50_000;
    this._replace = opts.replace ?? false;
    this._columns = [];
    this._bigIntWarned = false;
  }

  /** @returns {string[]} Column names detected after last load (empty before first load). */
  getColumns() {
    return [...this._columns];
  }

  /**
   * Parse a File object (from <input type="file"> or drag-and-drop).
   * @param {File} file
   */
  async loadFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const loader = this._selectLoader(file.name);
    await this._process(arrayBuffer, loader);
  }

  /**
   * Parse a remote URL.
   * @param {string} url
   * @param {RequestInit} [fetchOptions]
   */
  async loadURL(url, fetchOptions = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`TableLoaderAdapter: fetch failed ${response.status} ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    await this._process(arrayBuffer, this._selectLoader(url));
  }
  destroy() {
    this._columns = [];
    this._dataStore = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _selectLoader(name) {
    const ext = name.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'arrow') return arrow.ArrowLoader;
    if (ext === 'parquet') return parquet.ParquetLoader;
    return csv.CSVLoader;
  }
  async _process(arrayBuffer, loader) {
    let table;
    try {
      table = await core.parse(arrayBuffer, loader, {
        csv: {
          dynamicTyping: true
        },
        modules: {
          'zstd-codec': zstdCodec.ZstdCodec,
          'lz4js': lz4js,
          'snappy': snappy
        }
      });
    } catch (err) {
      throw new Error(`TableLoaderAdapter: parse failed — ${err.message}`);
    }

    // ── Discover columns — works for schema-less object-row-table (Parquet) ──
    const total = schema.getTableLength(table);
    if (total === 0) throw new Error('TableLoaderAdapter: file parsed but contains no rows — Parquet may use unsupported compression (try snappy or uncompressed)');
    const columns = Object.keys(schema.getTableRowAsObject(table, 0));

    // Always set before any possible throw so getColumns() works for probing
    this._columns = columns;
    if (!columns.includes(this._xCol)) throw new Error(`TableLoaderAdapter: column "${this._xCol}" not found. Available: ${columns.join(', ')}`);
    if (!columns.includes(this._yCol)) throw new Error(`TableLoaderAdapter: column "${this._yCol}" not found. Available: ${columns.join(', ')}`);
    if (this._replace) this._dataStore.clear();

    // ── Stream in chunks ───────────────────────────────────────────────────
    let loaded = 0;
    while (loaded < total) {
      const end = Math.min(loaded + this._chunkSize, total);
      const count = end - loaded;
      const x = new Float32Array(count);
      const y = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        x[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._xCol), this._xCol, loaded + i);
        y[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._yCol), this._yCol, loaded + i);
      }
      const bufferStruct = {
        x,
        y
      };

      // Optional size
      if (typeof this._sizeOpt === 'string' && columns.includes(this._sizeOpt)) {
        const size = new Float32Array(count);
        for (let i = 0; i < count; i++) size[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._sizeOpt), this._sizeOpt, loaded + i);
        bufferStruct.size = size;
      } else if (typeof this._sizeOpt === 'number') {
        bufferStruct.size = new Float32Array(count).fill(this._sizeOpt);
      }

      // Optional color
      if (typeof this._colorOpt === 'function') {
        bufferStruct.color = this._buildColor(table, loaded, count, null);
      } else if (typeof this._colorOpt === 'string' && columns.includes(this._colorOpt)) {
        bufferStruct.color = this._buildColor(table, loaded, count, this._colorOpt);
      }
      this._dataStore.appendData(bufferStruct);
      loaded = end;
      this.emit('chunk', {
        loaded,
        total
      });
    }
    this.emit('loaded', {
      rowCount: total,
      columns: this._columns
    });
  }
  _toFloat(value, colName, rowIndex) {
    if (value == null || typeof value === 'number' && isNaN(value)) {
      this.emit('parseWarning', {
        message: `null/NaN at row ${rowIndex} col "${colName}", replaced with 0`
      });
      return 0;
    }
    if (typeof value === 'bigint') {
      if (!this._bigIntWarned) {
        console.warn(`TableLoaderAdapter: BigInt column "${colName}" converted to Float32 — precision may be lost.`);
        this._bigIntWarned = true;
      }
      return Number(value);
    }
    return Number(value);
  }
  _buildColor(table, startRow, count, colorColName) {
    const result = new Uint8Array(count * 4);
    const fn = typeof this._colorOpt === 'function' ? this._colorOpt : null;
    for (let i = 0; i < count; i++) {
      const raw = colorColName ? schema.getTableCell(table, startRow + i, colorColName) : 0;
      const rgba = fn ? fn(raw) : [255, 255, 255, 255];
      if (Array.isArray(rgba) && rgba.length >= 3) {
        result[i * 4 + 0] = rgba[0] & 0xff;
        result[i * 4 + 1] = rgba[1] & 0xff;
        result[i * 4 + 2] = rgba[2] & 0xff;
        result[i * 4 + 3] = rgba[3] != null ? rgba[3] & 0xff : 255;
      } else {
        result[i * 4 + 0] = result[i * 4 + 1] = result[i * 4 + 2] = result[i * 4 + 3] = 255;
      }
    }
    return result;
  }
}

/**
 * RasterLoaderAdapter — F33
 *
 * Loads a gridded dataset (NetCDF3, or any image format) and registers a
 * BitmapDataLayer on a PlotController with the correct bitMapping.bounds.
 *
 * Supported formats:
 *   .nc / .cdf      → @loaders.gl/netcdf  NetCDFLoader (NetCDF v3 classic)
 *   .png / .jpg     → browser createImageBitmap (bounds default to pixel dimensions)
 *   .webp / .bmp    → browser createImageBitmap
 *   .tif / .tiff    → createImageBitmap (partial; full GeoTIFF metadata not decoded)
 *
 * NetCDF4 (HDF5-based .nc4) is NOT supported by @loaders.gl/netcdf (only v3 classic).
 * A warning is emitted if the file header does not match CDF magic bytes.
 *
 * Usage:
 *   const adapter = new RasterLoaderAdapter(plotController, {
 *     layerId:    'temperature',
 *     variable:   'temp',
 *     xDim:       'lon',
 *     yDim:       'lat',
 *     lutController: myLUT,
 *   });
 *   await adapter.loadFile(file);
 *
 * Events: 'loaded' { width, height, variable, bounds }, 'parseWarning' { message }
 */

class RasterLoaderAdapter extends events.EventEmitter {
  /**
   * @param {import('../src/plot/PlotController.js').PlotController} plotController
   * @param {object} opts
   * @param {string}  [opts.layerId='raster']    — id passed to plotController.registerDataLayer
   * @param {string}  [opts.variable]            — NetCDF variable name (ignored for image formats)
   * @param {string}  [opts.xDim='lon']          — NetCDF dimension name for X axis
   * @param {string}  [opts.yDim='lat']          — NetCDF dimension name for Y axis
   * @param {object|null} [opts.lutController]   — optional LUTController for colormapping
   * @param {boolean} [opts.flipY=true]          — flip row order so row-0 = bottom (raster convention)
   */
  constructor(plotController, opts = {}) {
    super();
    if (!plotController) throw new Error('RasterLoaderAdapter: plotController is required');
    this._ctrl = plotController;
    this._layerId = opts.layerId ?? 'raster';
    this._variable = opts.variable ?? null;
    this._xDim = opts.xDim ?? 'lon';
    this._yDim = opts.yDim ?? 'lat';
    this._lutController = opts.lutController ?? null;
    this._flipY = opts.flipY ?? true;
    this._variables = [];
    this._dimensions = {};

    // Internal layer state (bumped to trigger BitmapDataLayer re-render)
    this._dataTrigger = 0;
    this._colorTrigger = 0;

    // Wired LUT listener
    this._onLutChanged = () => {
      this._colorTrigger++;
      this._ctrl.markDirty();
    };
    if (this._lutController) {
      this._lutController.on('levelChanged', this._onLutChanged);
      this._lutController.on('lutChanged', this._onLutChanged);
    }
  }

  /**
   * @returns {string[]} Available NetCDF variable names (empty for image formats).
   */
  getVariables() {
    return [...this._variables];
  }

  /**
   * @returns {{ [varName]: string[] }} Dimension names per variable (empty for image formats).
   */
  getDimensions() {
    return {
      ...this._dimensions
    };
  }

  /** Load from a File object (from <input type="file"> or drag-and-drop). */
  async loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'nc' || ext === 'cdf' || ext === 'nc4') {
      const arrayBuffer = await file.arrayBuffer();
      await this._loadNetCDF(arrayBuffer);
    } else {
      await this._loadImageFile(file);
    }
  }

  /** Load from a URL. */
  async loadURL(url, fetchOptions = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`RasterLoaderAdapter: fetch failed: ${response.status} ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'nc' || ext === 'cdf' || ext === 'nc4') {
      await this._loadNetCDF(arrayBuffer);
    } else {
      const blob = new Blob([arrayBuffer]);
      const blobFile = new File([blob], url, {
        type: this._guessMimeType(url)
      });
      await this._loadImageFile(blobFile);
    }
  }

  /**
   * Load a typed-array grid directly (bypasses file parsing).
   * Useful when the data is already in memory (e.g. generated in JS).
   *
   * @param {Float32Array|Uint8Array} data — flat row-major pixel data
   * @param {number}  width
   * @param {number}  height
   * @param {object}  [opts]
   * @param {number[]}[opts.bounds]   — [left, bottom, right, top] in data space (default pixel dims)
   * @param {string}  [opts.channels] — 'gray'|'rgb'|'rgba' (default 'gray')
   * @param {string}  [opts.dtype]    — 'float32'|'uint8' etc (default 'float32')
   */
  loadArray(data, width, height, opts = {}) {
    const bounds = opts.bounds ?? [0, 0, width, height];
    const channels = opts.channels ?? 'gray';
    const dtype = opts.dtype ?? 'float32';
    const grid = this._flipY && channels === 'gray' ? this._flipRows(new Float32Array(data), width, height) : data;
    if (this._lutController && channels === 'gray') {
      this._lutController.setData(grid, this._arrayMin(grid), this._arrayMax(grid));
    }
    this._registerLayer({
      source: grid,
      width,
      height,
      channels,
      dtype,
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: null,
      bounds
    });
  }

  /** Remove the registered BitmapDataLayer and clean up listeners. */
  destroy() {
    this._ctrl.unregisterDataLayer(this._layerId);
    if (this._lutController) {
      this._lutController.off('levelChanged', this._onLutChanged);
      this._lutController.off('lutChanged', this._onLutChanged);
    }
    this._ctrl = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async _loadNetCDF(arrayBuffer) {
    let parsed;
    try {
      parsed = await core.parse(arrayBuffer, netcdf.NetCDFLoader, {
        netcdf: {
          loadData: true
        }
      });
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: NetCDF parse failed — ${err.message}. ` + 'Note: only NetCDF v3 classic format is supported by @loaders.gl/netcdf.');
    }

    // Populate metadata for getVariables() / getDimensions()
    const header = parsed.loaderData;
    if (header && header.variables) {
      this._variables = header.variables.map(v => v.name);
      for (const v of header.variables) {
        this._dimensions[v.name] = v.dimensions ? [...v.dimensions] : [];
      }
    }

    // Choose variable
    const varName = this._variable ?? this._variables.find(n => !this._isDimCoord(n, header)) ?? this._variables[0];
    if (!varName) throw new Error('RasterLoaderAdapter: no variables found in NetCDF file');
    const varData = parsed.data[varName];
    if (!varData) throw new Error(`RasterLoaderAdapter: variable "${varName}" not found in parsed data`);

    // Determine grid dimensions from the variable's dimension list
    const varMeta = header.variables.find(v => v.name === varName);
    const dimNames = varMeta?.dimensions ?? [];
    const dims = dimNames.map(dn => header.dimensions.find(d => d.name === dn));
    if (dims.length < 2) {
      throw new Error(`RasterLoaderAdapter: variable "${varName}" must have at least 2 dimensions, found ${dims.length}`);
    }

    // Assume last two dims are [y, x] (latitude, longitude order)
    const yDimMeta = dims[dims.length - 2];
    const xDimMeta = dims[dims.length - 1];
    const height = yDimMeta?.size ?? 1;
    const width = xDimMeta?.size ?? 1;

    // Try to read coordinate arrays (dimension coordinate variables named after dims)
    const xCoords = parsed.data[xDimMeta.name] ?? null;
    const yCoords = parsed.data[yDimMeta.name] ?? null;
    let bounds;
    if (xCoords && xCoords.length >= 2 && yCoords && yCoords.length >= 2) {
      // Infer grid spacing (half-cell padding for correct edge alignment)
      const xMin = xCoords[0];
      const xMax = xCoords[xCoords.length - 1];
      const yMin = yCoords[0];
      const yMax = yCoords[yCoords.length - 1];
      const dxHalf = Math.abs(xMax - xMin) / Math.max(1, xCoords.length - 1) / 2;
      const dyHalf = Math.abs(yMax - yMin) / Math.max(1, yCoords.length - 1) / 2;
      bounds = [Math.min(xMin, xMax) - dxHalf, Math.min(yMin, yMax) - dyHalf, Math.max(xMin, xMax) + dxHalf, Math.max(yMin, yMax) + dyHalf];
    } else {
      // No coordinate variables — use pixel indices
      bounds = [0, 0, width, height];
      this.emit('parseWarning', {
        message: `No coordinate arrays found for dims "${xDimMeta.name}"/"${yDimMeta.name}" — using pixel bounds [0,0,${width},${height}]`
      });
    }

    // Flatten to Float32Array
    const flat = this._toFloat32(varData, width * height);

    // FlipY: rasters store row-0 at top; BitmapDataLayer row-0 = bottom
    const grid = this._flipY ? this._flipRows(flat, width, height) : flat;

    // LUT data
    if (this._lutController) {
      const min = this._arrayMin(grid);
      const max = this._arrayMax(grid);
      this._lutController.setData(grid, min, max);
    }
    this._registerLayer({
      source: grid,
      width,
      height,
      channels: 'gray',
      dtype: 'float32',
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: varName,
      bounds
    });
  }
  async _loadImageFile(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: createImageBitmap failed — ${err.message}`);
    }
    const width = bitmap.width;
    const height = bitmap.height;
    const bounds = [0, 0, width, height];
    this._registerLayer({
      source: bitmap,
      width,
      height,
      channels: 'rgba',
      dtype: 'uint8',
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: null,
      bounds
    });
  }
  _registerLayer({
    source,
    width,
    height,
    channels,
    dtype,
    bounds
  }) {
    const dataTrigger = ++this._dataTrigger;
    const colorTrigger = this._colorTrigger;
    const lutController = this._lutController;
    this._ctrl.registerDataLayer(this._layerId, () => new BitmapDataLayer_js.BitmapDataLayer({
      id: this._layerId,
      source,
      width,
      height,
      channels,
      dtype,
      bitMapping: {
        bounds
      },
      lutController,
      dataTrigger,
      colorTrigger
    }));
    this._ctrl.markDirty();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _isDimCoord(varName, header) {
    return header.dimensions && header.dimensions.some(d => d.name === varName);
  }
  _toFloat32(raw, length) {
    if (raw instanceof Float32Array) return raw;
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) out[i] = Number(raw[i] ?? 0);
    return out;
  }
  _flipRows(flat, width, height) {
    const out = new Float32Array(flat.length);
    for (let row = 0; row < height; row++) {
      const srcRow = height - 1 - row;
      out.set(flat.subarray(srcRow * width, (srcRow + 1) * width), row * width);
    }
    return out;
  }
  _arrayMin(arr) {
    let min = Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] < min) min = arr[i];
    return min;
  }
  _arrayMax(arr) {
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    return max;
  }
  _guessMimeType(url) {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif'
    };
    return map[ext] || 'application/octet-stream';
  }
}

exports.RasterLoaderAdapter = RasterLoaderAdapter;
exports.TableLoaderAdapter = TableLoaderAdapter;
//# sourceMappingURL=loaders.cjs.js.map
