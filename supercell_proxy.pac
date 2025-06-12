function FindProxyForURL(url, host) {
  if (dnsDomainIs(host, "supercell.com") ||
      shExpMatch(host, "*.supercell.com")) {
    return "PROXY daatc-2975.px.digitalartscloud.com:443";
  }
  return "DIRECT";
}
