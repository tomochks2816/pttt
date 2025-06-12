function FindProxyForURL(url, host) {
  if (dnsDomainIs(host, "cman.jp") || shExpMatch(host, "*.cman.jp")) {
    return "PROXY daatc-2975.px.digitalartscloud.com:443";
  }
  return "DIRECT";
}
