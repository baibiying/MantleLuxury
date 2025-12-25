# 使用多阶段构建优化镜像大小
FROM gradle:8.14.3-jdk17 AS build

WORKDIR /app

# 复制 Gradle 配置文件
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# 复制源代码
COPY src ./src

# 构建应用（直接使用 gradle 命令，因为 gradle 镜像已经包含了 gradle）
RUN gradle bootJar --no-daemon

# 运行阶段
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 从构建阶段复制 JAR 文件
COPY --from=build /app/build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar app.jar

# 暴露端口
EXPOSE 8080

# 启动应用（支持 Railway 的 PORT 环境变量）
ENTRYPOINT ["sh", "-c", "java -jar -Dserver.port=${PORT:-8080} app.jar"]

