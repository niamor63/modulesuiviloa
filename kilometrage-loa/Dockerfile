FROM node:22-alpine

ARG BUILD_VERSION
ARG BUILD_ARCH

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="${BUILD_ARCH}"

WORKDIR /app

COPY index.html styles.css app.js manifest.webmanifest server.js ./

ENV PORT=8099
ENV DATA_DIR=/data

EXPOSE 8099

CMD ["node", "server.js"]
