#!/bin/sh
# Chạy hai nguồn AI trong một container. Biến môi trường do nền tảng cloud cung cấp (không dùng file .env).
# Nguồn 2: ví và model riêng, không mở cổng health.
AI_KEY_VAR=AI2_SERVICE_PRIVATE_KEY AGENT_MODEL=gemini-3.5-flash-lite PORT= node src/index.js &
# Nguồn 1 mở cổng health theo biến PORT của nền tảng.
exec node src/index.js
