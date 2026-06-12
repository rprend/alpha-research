// Phase 1: citywide aerial/ortho vintages on NYC's public tile service.
// Scheme verified 2026-06-12: https://maps.nyc.gov/xyz/1.0.0/photo/{v}/{z}/{x}/{y}.png8
// (2020+ vintages redirect to a dead host — last live layer is 2018.)
export const AERIAL_VINTAGES = ['1924', '1951', '1996', '2001-2', '2004', '2006', '2008', '2010', '2012', '2014', '2016', '2018'];

export function tileXY(lat, lon, z = 18) {
  const x = Math.floor(((lon + 180) / 360) * 2 ** z);
  const latR = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * 2 ** z);
  return { z, x, y };
}

export function aerialUrls(lat, lon, z = 18) {
  if (lat == null || lon == null) return [];
  const { x, y } = tileXY(Number(lat), Number(lon), z);
  return AERIAL_VINTAGES.map((v) => ({
    vintage: v,
    url: `https://maps.nyc.gov/xyz/1.0.0/photo/${v}/${z}/${x}/${y}.png8`,
  }));
}
