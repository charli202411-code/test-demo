# 实习罗盘 · 静态原型部署（仅前端，无后端、无数据库、无外部服务）
FROM nginx:1.27-alpine

# 只复制前端静态资源；文档/配置/校验脚本与本地凭据目录均不进入镜像
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
