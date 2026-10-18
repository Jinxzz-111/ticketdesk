FROM nginx:1.27-alpine
ARG BUILD_NUMBER=dev
COPY src /usr/share/nginx/html
RUN echo "window.BUILD='${BUILD_NUMBER}';" > /usr/share/nginx/html/version.js
