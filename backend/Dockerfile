# 使用多阶段构建优化镜像大小
FROM gradle:8.14.3-jdk17 AS build

WORKDIR /app

# 复制 Gradle 配置文件
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# 复制源代码
COPY src ./src

# 构建应用（直接使用 gradle 命令，因为 gradle 镜像已经包含了 gradle）
# 跳过测试以加快构建速度
RUN gradle bootJar --no-daemon -x test

# 验证 JAR 文件是否存在
RUN ls -la build/libs/ && \
    find build/libs -name "*.jar" && \
    test -f build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar || \
    (echo "ERROR: JAR file not found! Available files:" && ls -la build/libs/ && exit 1)

# 运行阶段
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 从构建阶段复制整个 build/libs 目录，以匹配 Railway 配置中的路径
COPY --from=build /app/build/libs/ ./build/libs/

# 验证 JAR 文件是否存在
RUN ls -la build/libs/ && \
    test -f build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar || \
    (echo "ERROR: JAR file not found!" && ls -la build/libs/ && exit 1)

# 暴露端口
EXPOSE 8080

# 启动应用（支持 Railway 的 PORT 环境变量）
# 注意：Railway 可能会使用 Procfile 或 railway.json 中的 startCommand
# 如果使用 Dockerfile 的 ENTRYPOINT，使用这个命令
# 如果 Railway 使用配置文件中的命令，确保路径匹配
ENTRYPOINT ["sh", "-c", "java -jar -Dserver.port=${PORT:-8080} build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar"]

