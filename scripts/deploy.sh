#!/bin/bash
# ============================================
# 服务器端部署脚本
# 由 GitHub Actions deploy.yml 通过 SSH 远程调用
# 功能：拉取最新 GHCR 镜像 → 停止旧容器 → 启动新容器
# ============================================
set -e

echo "==> 登录 GitHub Container Registry"
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GITHUB_ACTOR}" --password-stdin

echo "==> 拉取最新镜像"
docker compose -f docker-compose.yml pull

echo "==> 重启容器（零停机）"
docker compose -f docker-compose.yml up -d --remove-orphans

echo "==> 清理旧镜像（释放磁盘空间）"
docker image prune -af

echo "==> 部署完成"
