export function getHQThumbnail(url: string): string {
  if (!url) return url;
  if (url.includes("lh3.googleusercontent.com") || url.includes("googleusercontent.com")) {
    return url
      .replace(/=w\d+-h\d+[^&?]*/g, "=w600-h600-l90-rj")
      .replace(/=s\d+[^&?]*/g, "=s600");
  }
  if (url.includes("i.ytimg.com")) {
    return url.replace(/(hq|mq|sd|default)default/, "hqdefault");
  }
  return url;
}
