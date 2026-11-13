// Worldwide ISO 3166-1 countries and territories, not a statement of service availability.
// Pinned source: https://github.com/datasets/country-codes/blob/a6129fd4a004685c51432ddc04e3543ff750bef7/data/country-codes.csv
// Retrieved 2026-11-05. Fields: Alpha-2, CLDR display name, Continent. Dataset arrangement: PDDL.
// Country names and codes are factual identifiers; no provider or travel eligibility is implied.
export interface Country { code: string; name: string; slug: string; continent: string }
export const COUNTRIES: Country[] = [
  {
    "code": "AF",
    "name": "Afghanistan",
    "slug": "afghanistan",
    "continent": "Asia"
  },
  {
    "code": "AL",
    "name": "Albania",
    "slug": "albania",
    "continent": "Europe"
  },
  {
    "code": "DZ",
    "name": "Algeria",
    "slug": "algeria",
    "continent": "Africa"
  },
  {
    "code": "AS",
    "name": "American Samoa",
    "slug": "american-samoa",
    "continent": "Oceania"
  },
  {
    "code": "AD",
    "name": "Andorra",
    "slug": "andorra",
    "continent": "Europe"
  },
  {
    "code": "AO",
    "name": "Angola",
    "slug": "angola",
    "continent": "Africa"
  },
  {
    "code": "AI",
    "name": "Anguilla",
    "slug": "anguilla",
    "continent": "North America"
  },
  {
    "code": "AQ",
    "name": "Antarctica",
    "slug": "antarctica",
    "continent": "Antarctica"
  },
  {
    "code": "AG",
    "name": "Antigua & Barbuda",
    "slug": "antigua-barbuda",
    "continent": "North America"
  },
  {
    "code": "AR",
    "name": "Argentina",
    "slug": "argentina",
    "continent": "South America"
  },
  {
    "code": "AM",
    "name": "Armenia",
    "slug": "armenia",
    "continent": "Asia"
  },
  {
    "code": "AW",
    "name": "Aruba",
    "slug": "aruba",
    "continent": "North America"
  },
  {
    "code": "AU",
    "name": "Australia",
    "slug": "australia",
    "continent": "Oceania"
  },
  {
    "code": "AT",
    "name": "Austria",
    "slug": "austria",
    "continent": "Europe"
  },
  {
    "code": "AZ",
    "name": "Azerbaijan",
    "slug": "azerbaijan",
    "continent": "Asia"
  },
  {
    "code": "BS",
    "name": "Bahamas",
    "slug": "bahamas",
    "continent": "North America"
  },
  {
    "code": "BH",
    "name": "Bahrain",
    "slug": "bahrain",
    "continent": "Asia"
  },
  {
    "code": "BD",
    "name": "Bangladesh",
    "slug": "bangladesh",
    "continent": "Asia"
  },
  {
    "code": "BB",
    "name": "Barbados",
    "slug": "barbados",
    "continent": "North America"
  },
  {
    "code": "BY",
    "name": "Belarus",
    "slug": "belarus",
    "continent": "Europe"
  },
  {
    "code": "BE",
    "name": "Belgium",
    "slug": "belgium",
    "continent": "Europe"
  },
  {
    "code": "BZ",
    "name": "Belize",
    "slug": "belize",
    "continent": "North America"
  },
  {
    "code": "BJ",
    "name": "Benin",
    "slug": "benin",
    "continent": "Africa"
  },
  {
    "code": "BM",
    "name": "Bermuda",
    "slug": "bermuda",
    "continent": "North America"
  },
  {
    "code": "BT",
    "name": "Bhutan",
    "slug": "bhutan",
    "continent": "Asia"
  },
  {
    "code": "BO",
    "name": "Bolivia",
    "slug": "bolivia",
    "continent": "South America"
  },
  {
    "code": "BA",
    "name": "Bosnia",
    "slug": "bosnia",
    "continent": "Europe"
  },
  {
    "code": "BW",
    "name": "Botswana",
    "slug": "botswana",
    "continent": "Africa"
  },
  {
    "code": "BV",
    "name": "Bouvet Island",
    "slug": "bouvet-island",
    "continent": "Antarctica"
  },
  {
    "code": "BR",
    "name": "Brazil",
    "slug": "brazil",
    "continent": "South America"
  },
  {
    "code": "IO",
    "name": "British Indian Ocean Territory",
    "slug": "british-indian-ocean-territory",
    "continent": "Asia"
  },
  {
    "code": "VG",
    "name": "British Virgin Islands",
    "slug": "british-virgin-islands",
    "continent": "North America"
  },
  {
    "code": "BN",
    "name": "Brunei",
    "slug": "brunei",
    "continent": "Asia"
  },
  {
    "code": "BG",
    "name": "Bulgaria",
    "slug": "bulgaria",
    "continent": "Europe"
  },
  {
    "code": "BF",
    "name": "Burkina Faso",
    "slug": "burkina-faso",
    "continent": "Africa"
  },
  {
    "code": "BI",
    "name": "Burundi",
    "slug": "burundi",
    "continent": "Africa"
  },
  {
    "code": "KH",
    "name": "Cambodia",
    "slug": "cambodia",
    "continent": "Asia"
  },
  {
    "code": "CM",
    "name": "Cameroon",
    "slug": "cameroon",
    "continent": "Africa"
  },
  {
    "code": "CA",
    "name": "Canada",
    "slug": "canada",
    "continent": "North America"
  },
  {
    "code": "CV",
    "name": "Cape Verde",
    "slug": "cape-verde",
    "continent": "Africa"
  },
  {
    "code": "BQ",
    "name": "Caribbean Netherlands",
    "slug": "caribbean-netherlands",
    "continent": "North America"
  },
  {
    "code": "KY",
    "name": "Cayman Islands",
    "slug": "cayman-islands",
    "continent": "North America"
  },
  {
    "code": "CF",
    "name": "Central African Republic",
    "slug": "central-african-republic",
    "continent": "Africa"
  },
  {
    "code": "TD",
    "name": "Chad",
    "slug": "chad",
    "continent": "Africa"
  },
  {
    "code": "CL",
    "name": "Chile",
    "slug": "chile",
    "continent": "South America"
  },
  {
    "code": "CN",
    "name": "China",
    "slug": "china",
    "continent": "Asia"
  },
  {
    "code": "CX",
    "name": "Christmas Island",
    "slug": "christmas-island",
    "continent": "Oceania"
  },
  {
    "code": "CC",
    "name": "Cocos Islands",
    "slug": "cocos-islands",
    "continent": "Asia"
  },
  {
    "code": "CO",
    "name": "Colombia",
    "slug": "colombia",
    "continent": "South America"
  },
  {
    "code": "KM",
    "name": "Comoros",
    "slug": "comoros",
    "continent": "Africa"
  },
  {
    "code": "CG",
    "name": "Congo - Brazzaville",
    "slug": "congo-brazzaville",
    "continent": "Africa"
  },
  {
    "code": "CD",
    "name": "Congo - Kinshasa",
    "slug": "congo-kinshasa",
    "continent": "Africa"
  },
  {
    "code": "CK",
    "name": "Cook Islands",
    "slug": "cook-islands",
    "continent": "Oceania"
  },
  {
    "code": "CR",
    "name": "Costa Rica",
    "slug": "costa-rica",
    "continent": "North America"
  },
  {
    "code": "HR",
    "name": "Croatia",
    "slug": "croatia",
    "continent": "Europe"
  },
  {
    "code": "CU",
    "name": "Cuba",
    "slug": "cuba",
    "continent": "North America"
  },
  {
    "code": "CW",
    "name": "Curaçao",
    "slug": "curacao",
    "continent": "North America"
  },
  {
    "code": "CY",
    "name": "Cyprus",
    "slug": "cyprus",
    "continent": "Europe"
  },
  {
    "code": "CZ",
    "name": "Czechia",
    "slug": "czechia",
    "continent": "Europe"
  },
  {
    "code": "CI",
    "name": "Côte d’Ivoire",
    "slug": "cote-divoire",
    "continent": "Africa"
  },
  {
    "code": "DK",
    "name": "Denmark",
    "slug": "denmark",
    "continent": "Europe"
  },
  {
    "code": "DJ",
    "name": "Djibouti",
    "slug": "djibouti",
    "continent": "Africa"
  },
  {
    "code": "DM",
    "name": "Dominica",
    "slug": "dominica",
    "continent": "North America"
  },
  {
    "code": "DO",
    "name": "Dominican Republic",
    "slug": "dominican-republic",
    "continent": "North America"
  },
  {
    "code": "EC",
    "name": "Ecuador",
    "slug": "ecuador",
    "continent": "South America"
  },
  {
    "code": "EG",
    "name": "Egypt",
    "slug": "egypt",
    "continent": "Africa"
  },
  {
    "code": "SV",
    "name": "El Salvador",
    "slug": "el-salvador",
    "continent": "North America"
  },
  {
    "code": "GQ",
    "name": "Equatorial Guinea",
    "slug": "equatorial-guinea",
    "continent": "Africa"
  },
  {
    "code": "ER",
    "name": "Eritrea",
    "slug": "eritrea",
    "continent": "Africa"
  },
  {
    "code": "EE",
    "name": "Estonia",
    "slug": "estonia",
    "continent": "Europe"
  },
  {
    "code": "SZ",
    "name": "Eswatini",
    "slug": "eswatini",
    "continent": "Africa"
  },
  {
    "code": "ET",
    "name": "Ethiopia",
    "slug": "ethiopia",
    "continent": "Africa"
  },
  {
    "code": "FK",
    "name": "Falkland Islands",
    "slug": "falkland-islands",
    "continent": "South America"
  },
  {
    "code": "FO",
    "name": "Faroe Islands",
    "slug": "faroe-islands",
    "continent": "Europe"
  },
  {
    "code": "FJ",
    "name": "Fiji",
    "slug": "fiji",
    "continent": "Oceania"
  },
  {
    "code": "FI",
    "name": "Finland",
    "slug": "finland",
    "continent": "Europe"
  },
  {
    "code": "FR",
    "name": "France",
    "slug": "france",
    "continent": "Europe"
  },
  {
    "code": "GF",
    "name": "French Guiana",
    "slug": "french-guiana",
    "continent": "South America"
  },
  {
    "code": "PF",
    "name": "French Polynesia",
    "slug": "french-polynesia",
    "continent": "Oceania"
  },
  {
    "code": "TF",
    "name": "French Southern Territories",
    "slug": "french-southern-territories",
    "continent": "Antarctica"
  },
  {
    "code": "GA",
    "name": "Gabon",
    "slug": "gabon",
    "continent": "Africa"
  },
  {
    "code": "GM",
    "name": "Gambia",
    "slug": "gambia",
    "continent": "Africa"
  },
  {
    "code": "GE",
    "name": "Georgia",
    "slug": "georgia",
    "continent": "Asia"
  },
  {
    "code": "DE",
    "name": "Germany",
    "slug": "germany",
    "continent": "Europe"
  },
  {
    "code": "GH",
    "name": "Ghana",
    "slug": "ghana",
    "continent": "Africa"
  },
  {
    "code": "GI",
    "name": "Gibraltar",
    "slug": "gibraltar",
    "continent": "Europe"
  },
  {
    "code": "GR",
    "name": "Greece",
    "slug": "greece",
    "continent": "Europe"
  },
  {
    "code": "GL",
    "name": "Greenland",
    "slug": "greenland",
    "continent": "North America"
  },
  {
    "code": "GD",
    "name": "Grenada",
    "slug": "grenada",
    "continent": "North America"
  },
  {
    "code": "GP",
    "name": "Guadeloupe",
    "slug": "guadeloupe",
    "continent": "North America"
  },
  {
    "code": "GU",
    "name": "Guam",
    "slug": "guam",
    "continent": "Oceania"
  },
  {
    "code": "GT",
    "name": "Guatemala",
    "slug": "guatemala",
    "continent": "North America"
  },
  {
    "code": "GG",
    "name": "Guernsey",
    "slug": "guernsey",
    "continent": "Europe"
  },
  {
    "code": "GN",
    "name": "Guinea",
    "slug": "guinea",
    "continent": "Africa"
  },
  {
    "code": "GW",
    "name": "Guinea-Bissau",
    "slug": "guinea-bissau",
    "continent": "Africa"
  },
  {
    "code": "GY",
    "name": "Guyana",
    "slug": "guyana",
    "continent": "South America"
  },
  {
    "code": "HT",
    "name": "Haiti",
    "slug": "haiti",
    "continent": "North America"
  },
  {
    "code": "HM",
    "name": "Heard & McDonald Islands",
    "slug": "heard-mcdonald-islands",
    "continent": "Antarctica"
  },
  {
    "code": "HN",
    "name": "Honduras",
    "slug": "honduras",
    "continent": "North America"
  },
  {
    "code": "HK",
    "name": "Hong Kong",
    "slug": "hong-kong",
    "continent": "Asia"
  },
  {
    "code": "HU",
    "name": "Hungary",
    "slug": "hungary",
    "continent": "Europe"
  },
  {
    "code": "IS",
    "name": "Iceland",
    "slug": "iceland",
    "continent": "Europe"
  },
  {
    "code": "IN",
    "name": "India",
    "slug": "india",
    "continent": "Asia"
  },
  {
    "code": "ID",
    "name": "Indonesia",
    "slug": "indonesia",
    "continent": "Asia"
  },
  {
    "code": "IR",
    "name": "Iran",
    "slug": "iran",
    "continent": "Asia"
  },
  {
    "code": "IQ",
    "name": "Iraq",
    "slug": "iraq",
    "continent": "Asia"
  },
  {
    "code": "IE",
    "name": "Ireland",
    "slug": "ireland",
    "continent": "Europe"
  },
  {
    "code": "IM",
    "name": "Isle of Man",
    "slug": "isle-of-man",
    "continent": "Europe"
  },
  {
    "code": "IL",
    "name": "Israel",
    "slug": "israel",
    "continent": "Asia"
  },
  {
    "code": "IT",
    "name": "Italy",
    "slug": "italy",
    "continent": "Europe"
  },
  {
    "code": "JM",
    "name": "Jamaica",
    "slug": "jamaica",
    "continent": "North America"
  },
  {
    "code": "JP",
    "name": "Japan",
    "slug": "japan",
    "continent": "Asia"
  },
  {
    "code": "JE",
    "name": "Jersey",
    "slug": "jersey",
    "continent": "Europe"
  },
  {
    "code": "JO",
    "name": "Jordan",
    "slug": "jordan",
    "continent": "Asia"
  },
  {
    "code": "KZ",
    "name": "Kazakhstan",
    "slug": "kazakhstan",
    "continent": "Asia"
  },
  {
    "code": "KE",
    "name": "Kenya",
    "slug": "kenya",
    "continent": "Africa"
  },
  {
    "code": "KI",
    "name": "Kiribati",
    "slug": "kiribati",
    "continent": "Oceania"
  },
  {
    "code": "KW",
    "name": "Kuwait",
    "slug": "kuwait",
    "continent": "Asia"
  },
  {
    "code": "KG",
    "name": "Kyrgyzstan",
    "slug": "kyrgyzstan",
    "continent": "Asia"
  },
  {
    "code": "LA",
    "name": "Laos",
    "slug": "laos",
    "continent": "Asia"
  },
  {
    "code": "LV",
    "name": "Latvia",
    "slug": "latvia",
    "continent": "Europe"
  },
  {
    "code": "LB",
    "name": "Lebanon",
    "slug": "lebanon",
    "continent": "Asia"
  },
  {
    "code": "LS",
    "name": "Lesotho",
    "slug": "lesotho",
    "continent": "Africa"
  },
  {
    "code": "LR",
    "name": "Liberia",
    "slug": "liberia",
    "continent": "Africa"
  },
  {
    "code": "LY",
    "name": "Libya",
    "slug": "libya",
    "continent": "Africa"
  },
  {
    "code": "LI",
    "name": "Liechtenstein",
    "slug": "liechtenstein",
    "continent": "Europe"
  },
  {
    "code": "LT",
    "name": "Lithuania",
    "slug": "lithuania",
    "continent": "Europe"
  },
  {
    "code": "LU",
    "name": "Luxembourg",
    "slug": "luxembourg",
    "continent": "Europe"
  },
  {
    "code": "MO",
    "name": "Macao",
    "slug": "macao",
    "continent": "Asia"
  },
  {
    "code": "MG",
    "name": "Madagascar",
    "slug": "madagascar",
    "continent": "Africa"
  },
  {
    "code": "MW",
    "name": "Malawi",
    "slug": "malawi",
    "continent": "Africa"
  },
  {
    "code": "MY",
    "name": "Malaysia",
    "slug": "malaysia",
    "continent": "Asia"
  },
  {
    "code": "MV",
    "name": "Maldives",
    "slug": "maldives",
    "continent": "Asia"
  },
  {
    "code": "ML",
    "name": "Mali",
    "slug": "mali",
    "continent": "Africa"
  },
  {
    "code": "MT",
    "name": "Malta",
    "slug": "malta",
    "continent": "Europe"
  },
  {
    "code": "MH",
    "name": "Marshall Islands",
    "slug": "marshall-islands",
    "continent": "Oceania"
  },
  {
    "code": "MQ",
    "name": "Martinique",
    "slug": "martinique",
    "continent": "North America"
  },
  {
    "code": "MR",
    "name": "Mauritania",
    "slug": "mauritania",
    "continent": "Africa"
  },
  {
    "code": "MU",
    "name": "Mauritius",
    "slug": "mauritius",
    "continent": "Africa"
  },
  {
    "code": "YT",
    "name": "Mayotte",
    "slug": "mayotte",
    "continent": "Africa"
  },
  {
    "code": "MX",
    "name": "Mexico",
    "slug": "mexico",
    "continent": "North America"
  },
  {
    "code": "FM",
    "name": "Micronesia",
    "slug": "micronesia",
    "continent": "Oceania"
  },
  {
    "code": "MD",
    "name": "Moldova",
    "slug": "moldova",
    "continent": "Europe"
  },
  {
    "code": "MC",
    "name": "Monaco",
    "slug": "monaco",
    "continent": "Europe"
  },
  {
    "code": "MN",
    "name": "Mongolia",
    "slug": "mongolia",
    "continent": "Asia"
  },
  {
    "code": "ME",
    "name": "Montenegro",
    "slug": "montenegro",
    "continent": "Europe"
  },
  {
    "code": "MS",
    "name": "Montserrat",
    "slug": "montserrat",
    "continent": "North America"
  },
  {
    "code": "MA",
    "name": "Morocco",
    "slug": "morocco",
    "continent": "Africa"
  },
  {
    "code": "MZ",
    "name": "Mozambique",
    "slug": "mozambique",
    "continent": "Africa"
  },
  {
    "code": "MM",
    "name": "Myanmar",
    "slug": "myanmar",
    "continent": "Asia"
  },
  {
    "code": "NA",
    "name": "Namibia",
    "slug": "namibia",
    "continent": "Africa"
  },
  {
    "code": "NR",
    "name": "Nauru",
    "slug": "nauru",
    "continent": "Oceania"
  },
  {
    "code": "NP",
    "name": "Nepal",
    "slug": "nepal",
    "continent": "Asia"
  },
  {
    "code": "NL",
    "name": "Netherlands",
    "slug": "netherlands",
    "continent": "Europe"
  },
  {
    "code": "NC",
    "name": "New Caledonia",
    "slug": "new-caledonia",
    "continent": "Oceania"
  },
  {
    "code": "NZ",
    "name": "New Zealand",
    "slug": "new-zealand",
    "continent": "Oceania"
  },
  {
    "code": "NI",
    "name": "Nicaragua",
    "slug": "nicaragua",
    "continent": "North America"
  },
  {
    "code": "NE",
    "name": "Niger",
    "slug": "niger",
    "continent": "Africa"
  },
  {
    "code": "NG",
    "name": "Nigeria",
    "slug": "nigeria",
    "continent": "Africa"
  },
  {
    "code": "NU",
    "name": "Niue",
    "slug": "niue",
    "continent": "Oceania"
  },
  {
    "code": "NF",
    "name": "Norfolk Island",
    "slug": "norfolk-island",
    "continent": "Oceania"
  },
  {
    "code": "KP",
    "name": "North Korea",
    "slug": "north-korea",
    "continent": "Asia"
  },
  {
    "code": "MK",
    "name": "North Macedonia",
    "slug": "north-macedonia",
    "continent": "Europe"
  },
  {
    "code": "MP",
    "name": "Northern Mariana Islands",
    "slug": "northern-mariana-islands",
    "continent": "Oceania"
  },
  {
    "code": "NO",
    "name": "Norway",
    "slug": "norway",
    "continent": "Europe"
  },
  {
    "code": "OM",
    "name": "Oman",
    "slug": "oman",
    "continent": "Asia"
  },
  {
    "code": "PK",
    "name": "Pakistan",
    "slug": "pakistan",
    "continent": "Asia"
  },
  {
    "code": "PW",
    "name": "Palau",
    "slug": "palau",
    "continent": "Oceania"
  },
  {
    "code": "PS",
    "name": "Palestine",
    "slug": "palestine",
    "continent": "Asia"
  },
  {
    "code": "PA",
    "name": "Panama",
    "slug": "panama",
    "continent": "North America"
  },
  {
    "code": "PG",
    "name": "Papua New Guinea",
    "slug": "papua-new-guinea",
    "continent": "Oceania"
  },
  {
    "code": "PY",
    "name": "Paraguay",
    "slug": "paraguay",
    "continent": "South America"
  },
  {
    "code": "PE",
    "name": "Peru",
    "slug": "peru",
    "continent": "South America"
  },
  {
    "code": "PH",
    "name": "Philippines",
    "slug": "philippines",
    "continent": "Asia"
  },
  {
    "code": "PN",
    "name": "Pitcairn",
    "slug": "pitcairn",
    "continent": "Oceania"
  },
  {
    "code": "PL",
    "name": "Poland",
    "slug": "poland",
    "continent": "Europe"
  },
  {
    "code": "PT",
    "name": "Portugal",
    "slug": "portugal",
    "continent": "Europe"
  },
  {
    "code": "PR",
    "name": "Puerto Rico",
    "slug": "puerto-rico",
    "continent": "North America"
  },
  {
    "code": "QA",
    "name": "Qatar",
    "slug": "qatar",
    "continent": "Asia"
  },
  {
    "code": "RO",
    "name": "Romania",
    "slug": "romania",
    "continent": "Europe"
  },
  {
    "code": "RU",
    "name": "Russia",
    "slug": "russia",
    "continent": "Europe"
  },
  {
    "code": "RW",
    "name": "Rwanda",
    "slug": "rwanda",
    "continent": "Africa"
  },
  {
    "code": "RE",
    "name": "Réunion",
    "slug": "reunion",
    "continent": "Africa"
  },
  {
    "code": "WS",
    "name": "Samoa",
    "slug": "samoa",
    "continent": "Oceania"
  },
  {
    "code": "SM",
    "name": "San Marino",
    "slug": "san-marino",
    "continent": "Europe"
  },
  {
    "code": "SA",
    "name": "Saudi Arabia",
    "slug": "saudi-arabia",
    "continent": "Asia"
  },
  {
    "code": "SN",
    "name": "Senegal",
    "slug": "senegal",
    "continent": "Africa"
  },
  {
    "code": "RS",
    "name": "Serbia",
    "slug": "serbia",
    "continent": "Europe"
  },
  {
    "code": "SC",
    "name": "Seychelles",
    "slug": "seychelles",
    "continent": "Africa"
  },
  {
    "code": "SL",
    "name": "Sierra Leone",
    "slug": "sierra-leone",
    "continent": "Africa"
  },
  {
    "code": "SG",
    "name": "Singapore",
    "slug": "singapore",
    "continent": "Asia"
  },
  {
    "code": "SX",
    "name": "Sint Maarten",
    "slug": "sint-maarten",
    "continent": "North America"
  },
  {
    "code": "SK",
    "name": "Slovakia",
    "slug": "slovakia",
    "continent": "Europe"
  },
  {
    "code": "SI",
    "name": "Slovenia",
    "slug": "slovenia",
    "continent": "Europe"
  },
  {
    "code": "SB",
    "name": "Solomon Islands",
    "slug": "solomon-islands",
    "continent": "Oceania"
  },
  {
    "code": "SO",
    "name": "Somalia",
    "slug": "somalia",
    "continent": "Africa"
  },
  {
    "code": "ZA",
    "name": "South Africa",
    "slug": "south-africa",
    "continent": "Africa"
  },
  {
    "code": "GS",
    "name": "South Georgia & South Sandwich Islands",
    "slug": "south-georgia-south-sandwich-islands",
    "continent": "Antarctica"
  },
  {
    "code": "KR",
    "name": "South Korea",
    "slug": "south-korea",
    "continent": "Asia"
  },
  {
    "code": "SS",
    "name": "South Sudan",
    "slug": "south-sudan",
    "continent": "Africa"
  },
  {
    "code": "ES",
    "name": "Spain",
    "slug": "spain",
    "continent": "Europe"
  },
  {
    "code": "LK",
    "name": "Sri Lanka",
    "slug": "sri-lanka",
    "continent": "Asia"
  },
  {
    "code": "BL",
    "name": "St. Barthélemy",
    "slug": "st-barthelemy",
    "continent": "North America"
  },
  {
    "code": "SH",
    "name": "St. Helena",
    "slug": "st-helena",
    "continent": "Africa"
  },
  {
    "code": "KN",
    "name": "St. Kitts & Nevis",
    "slug": "st-kitts-nevis",
    "continent": "North America"
  },
  {
    "code": "LC",
    "name": "St. Lucia",
    "slug": "st-lucia",
    "continent": "North America"
  },
  {
    "code": "MF",
    "name": "St. Martin",
    "slug": "st-martin",
    "continent": "North America"
  },
  {
    "code": "PM",
    "name": "St. Pierre & Miquelon",
    "slug": "st-pierre-miquelon",
    "continent": "North America"
  },
  {
    "code": "VC",
    "name": "St. Vincent & Grenadines",
    "slug": "st-vincent-grenadines",
    "continent": "North America"
  },
  {
    "code": "SD",
    "name": "Sudan",
    "slug": "sudan",
    "continent": "Africa"
  },
  {
    "code": "SR",
    "name": "Suriname",
    "slug": "suriname",
    "continent": "South America"
  },
  {
    "code": "SJ",
    "name": "Svalbard & Jan Mayen",
    "slug": "svalbard-jan-mayen",
    "continent": "Europe"
  },
  {
    "code": "SE",
    "name": "Sweden",
    "slug": "sweden",
    "continent": "Europe"
  },
  {
    "code": "CH",
    "name": "Switzerland",
    "slug": "switzerland",
    "continent": "Europe"
  },
  {
    "code": "SY",
    "name": "Syria",
    "slug": "syria",
    "continent": "Asia"
  },
  {
    "code": "ST",
    "name": "São Tomé & Príncipe",
    "slug": "sao-tome-principe",
    "continent": "Africa"
  },
  {
    "code": "TW",
    "name": "Taiwan",
    "slug": "taiwan",
    "continent": "Asia"
  },
  {
    "code": "TJ",
    "name": "Tajikistan",
    "slug": "tajikistan",
    "continent": "Asia"
  },
  {
    "code": "TZ",
    "name": "Tanzania",
    "slug": "tanzania",
    "continent": "Africa"
  },
  {
    "code": "TH",
    "name": "Thailand",
    "slug": "thailand",
    "continent": "Asia"
  },
  {
    "code": "TL",
    "name": "Timor-Leste",
    "slug": "timor-leste",
    "continent": "Oceania"
  },
  {
    "code": "TG",
    "name": "Togo",
    "slug": "togo",
    "continent": "Africa"
  },
  {
    "code": "TK",
    "name": "Tokelau",
    "slug": "tokelau",
    "continent": "Oceania"
  },
  {
    "code": "TO",
    "name": "Tonga",
    "slug": "tonga",
    "continent": "Oceania"
  },
  {
    "code": "TT",
    "name": "Trinidad & Tobago",
    "slug": "trinidad-tobago",
    "continent": "North America"
  },
  {
    "code": "TN",
    "name": "Tunisia",
    "slug": "tunisia",
    "continent": "Africa"
  },
  {
    "code": "TM",
    "name": "Turkmenistan",
    "slug": "turkmenistan",
    "continent": "Asia"
  },
  {
    "code": "TC",
    "name": "Turks & Caicos Islands",
    "slug": "turks-caicos-islands",
    "continent": "North America"
  },
  {
    "code": "TV",
    "name": "Tuvalu",
    "slug": "tuvalu",
    "continent": "Oceania"
  },
  {
    "code": "TR",
    "name": "Türkiye",
    "slug": "turkiye",
    "continent": "Asia"
  },
  {
    "code": "UM",
    "name": "U.S. Outlying Islands",
    "slug": "u-s-outlying-islands",
    "continent": "Oceania"
  },
  {
    "code": "VI",
    "name": "U.S. Virgin Islands",
    "slug": "u-s-virgin-islands",
    "continent": "North America"
  },
  {
    "code": "GB",
    "name": "UK",
    "slug": "uk",
    "continent": "Europe"
  },
  {
    "code": "US",
    "name": "US",
    "slug": "us",
    "continent": "North America"
  },
  {
    "code": "UG",
    "name": "Uganda",
    "slug": "uganda",
    "continent": "Africa"
  },
  {
    "code": "UA",
    "name": "Ukraine",
    "slug": "ukraine",
    "continent": "Europe"
  },
  {
    "code": "AE",
    "name": "United Arab Emirates",
    "slug": "united-arab-emirates",
    "continent": "Asia"
  },
  {
    "code": "UY",
    "name": "Uruguay",
    "slug": "uruguay",
    "continent": "South America"
  },
  {
    "code": "UZ",
    "name": "Uzbekistan",
    "slug": "uzbekistan",
    "continent": "Asia"
  },
  {
    "code": "VU",
    "name": "Vanuatu",
    "slug": "vanuatu",
    "continent": "Oceania"
  },
  {
    "code": "VA",
    "name": "Vatican City",
    "slug": "vatican-city",
    "continent": "Europe"
  },
  {
    "code": "VE",
    "name": "Venezuela",
    "slug": "venezuela",
    "continent": "South America"
  },
  {
    "code": "VN",
    "name": "Vietnam",
    "slug": "vietnam",
    "continent": "Asia"
  },
  {
    "code": "WF",
    "name": "Wallis & Futuna",
    "slug": "wallis-futuna",
    "continent": "Oceania"
  },
  {
    "code": "EH",
    "name": "Western Sahara",
    "slug": "western-sahara",
    "continent": "Africa"
  },
  {
    "code": "YE",
    "name": "Yemen",
    "slug": "yemen",
    "continent": "Asia"
  },
  {
    "code": "ZM",
    "name": "Zambia",
    "slug": "zambia",
    "continent": "Africa"
  },
  {
    "code": "ZW",
    "name": "Zimbabwe",
    "slug": "zimbabwe",
    "continent": "Africa"
  },
  {
    "code": "AX",
    "name": "Åland Islands",
    "slug": "aland-islands",
    "continent": "Europe"
  }
];
