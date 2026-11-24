// 二进制模型资源：把原来 JS 里的 base64 字符串改为原始字节，减小包体并省去 base64 解析。
// 格式：'PBA1' | u32 头长度 | ASCII JSON 头 | 对齐到 4 字节 | 数据块。
// 头里的 {"$bin":[offset,length]} 会被还原为指向数据块的 Uint8Array。
const MAGIC = 'PBA1';

function ascii(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return text;
}

function parse(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (ascii(bytes.subarray(0, 4)) !== MAGIC) throw Error('Unknown model asset format');
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  const base = Math.ceil((8 + length) / 4) * 4;
  return JSON.parse(ascii(bytes.subarray(8, 8 + length)), (key, value) =>
    value && Array.isArray(value.$bin) ? bytes.subarray(base + value.$bin[0], base + value.$bin[0] + value.$bin[1]) : value);
}

function load(api, path) {
  return parse(api.getFileSystemManager().readFileSync(path));
}

module.exports = { MAGIC, parse, load };
