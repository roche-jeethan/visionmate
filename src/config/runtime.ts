export let SERVER_HOST = "localhost"; // default (no port)

export function setServerHost(host: string) {
  SERVER_HOST = host;
}

export function getServerHost() {
  return SERVER_HOST;
}
