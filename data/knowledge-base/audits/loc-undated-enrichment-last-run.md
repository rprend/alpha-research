# LOC Undated Enrichment

Generated at: 2026-06-14T22:14:35.541Z
Run ID: loc-undated-enrichment-2026-06-14T22-14-28-125Z
Status: success

Selected undated rows: 14
Enriched rows: 10
Failed rows: 4

This enrichment fetches Library of Congress `?fo=json` detail metadata for existing undated local KB rows and updates records in place. It avoids LOC API record creation timestamps as content dates.

## Examples

| Local ID | Title | Date | Medium |
| --- | --- | --- | --- |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0567 | Les Chiens Quadrille (The Dogs Quadrille) |  | 7 x 5 1/2 inches |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0514 | Colinet |  | 4 1/2 inches high |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0320 | [Boy playing a transverse flute] |  | 5 3/4 x 4 1/2 inches (14.7 x 11.5 cm.) |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0047 | Old Man playing Flute |  | 7 1/4 x 7 1/2 inches |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0092 | Concert du Faubourg St. Germain |  | 6 1/2 x 9 7/8 inches (16.5 x 25.1 cm.) |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0069 | Instruments de Musique / "Perse" - Plate 80 |  | 4 1/2 x 7 1/2 inches |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0650 | [Colophon - 1910 Türckische Chronica] |  | 4 1/4 x 4 1/2 inches |
| library-of-congress:http-www-loc-gov-item-musdcmicon-0379a | Apollon et Midas (Apollo and Midas) |  | 6 1/2 x 9 inches |
| library-of-congress:http-www-loc-gov-item-dc0492 | Mathew B. Brady Studio, 625 Pennsylvania Avenue Northwest, Washington, District of Columbia, DC | Documentation compiled after 1933 | Data Page(s): 14 |
| library-of-congress:http-www-loc-gov-item-ny0074 | Shaker South Family, General Views, Watervliet Shaker Road, Colonie Township, Watervliet, Albany County, NY | Documentation compiled after 1933 | Photo(s): 9 ; Measured Drawing(s): 1 ; Data Page(s): 8 ; Photo Caption Page(s): 1 |

## Failures

| Local ID | Error |
| --- | --- |
| library-of-congress:http-www-loc-gov-collections-lewis-carroll-scrapbook-about-this-collection | No richer date or descriptive metadata found in LOC detail JSON. |
| library-of-congress:https-www-loc-gov-preservation-conservators-bachbase-bbcbooks-detail-bbcbooks239-html | Unexpected token '<', "<!DOCTYPE "... is not valid JSON |
| library-of-congress:https-www-loc-gov-preservation-conservators-bachbase-bbcbooks-detail-bbcbooks23-html | Unexpected token '<', "<!DOCTYPE "... is not valid JSON |
| library-of-congress:https-www-loc-gov-preservation-conservators-bachbase-bbcbooks-detail-bbcbooks208-html | Unexpected token '<', "<!DOCTYPE "... is not valid JSON |

