-- QR Logo Studio 云端保存
-- 索引与元数据放 D1（强一致：保存后立刻出现在列表里）
-- 大对象（PNG 文件、Logo 原图）放 KV，见 public/_worker.js

CREATE TABLE IF NOT EXISTS qr_files (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  w           INTEGER NOT NULL DEFAULT 0,
  h           INTEGER NOT NULL DEFAULT 0,
  bytes       INTEGER NOT NULL DEFAULT 0,
  recipe      TEXT NOT NULL,           -- 全部可复现参数（JSON）
  has_logo    INTEGER NOT NULL DEFAULT 0,
  thumb       TEXT NOT NULL DEFAULT '' -- 列表缩略图 dataURL（约 10~20KB）
);

CREATE INDEX IF NOT EXISTS idx_qr_files_created ON qr_files (created_at DESC);
