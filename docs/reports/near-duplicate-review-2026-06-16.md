# Near-Duplicate Human Review Report

Generated: 2026-06-16T16:47:45.535Z
Mode: read-only review report; no Supabase mutations are performed without --apply.

## Summary

- Human-review clusters: 508
- Auto-supersede candidates visible in this run: 0
- Similarity threshold for auto candidates: 0.95

| Reason | Clusters |
|---|---:|
| financial-versions | 249 |
| mixed-type | 161 |
| sim 0.66 len 0.95 | 2 |
| sim 0.72 len 0.97 | 2 |
| sim 0.00 len 0.02 | 1 |
| sim 0.00 len 0.31 | 1 |
| sim 0.00 len 0.68 | 1 |
| sim 0.01 len 0.03 | 1 |
| sim 0.05 len 0.25 | 1 |
| sim 0.05 len 0.28 | 1 |
| sim 0.07 len 0.24 | 1 |
| sim 0.09 len 0.25 | 1 |
| sim 0.13 len 0.08 | 1 |
| sim 0.16 len 0.15 | 1 |
| sim 0.16 len 0.17 | 1 |
| sim 0.16 len 0.19 | 1 |
| sim 0.16 len 0.46 | 1 |
| sim 0.18 len 0.14 | 1 |
| sim 0.19 len 0.17 | 1 |
| sim 0.22 len 0.08 | 1 |
| sim 0.24 len 0.00 | 1 |
| sim 0.24 len 0.13 | 1 |
| sim 0.25 len 0.34 | 1 |
| sim 0.26 len 0.05 | 1 |
| sim 0.27 len 0.80 | 1 |
| sim 0.29 len 0.50 | 1 |
| sim 0.30 len 0.62 | 1 |
| sim 0.31 len 0.34 | 1 |
| sim 0.32 len 0.34 | 1 |
| sim 0.35 len 0.32 | 1 |
| sim 0.37 len 0.34 | 1 |
| sim 0.38 len 0.07 | 1 |
| sim 0.38 len 0.20 | 1 |
| sim 0.38 len 0.82 | 1 |
| sim 0.39 len 0.61 | 1 |
| sim 0.41 len 0.66 | 1 |
| sim 0.42 len 0.42 | 1 |
| sim 0.43 len 0.44 | 1 |
| sim 0.43 len 0.81 | 1 |
| sim 0.47 len 0.75 | 1 |
| sim 0.54 len 0.56 | 1 |
| sim 0.54 len 0.75 | 1 |
| sim 0.55 len 0.90 | 1 |
| sim 0.55 len 0.93 | 1 |
| sim 0.56 len 0.64 | 1 |
| sim 0.57 len 0.90 | 1 |
| sim 0.60 len 0.93 | 1 |
| sim 0.61 len 0.74 | 1 |
| sim 0.62 len 0.65 | 1 |
| sim 0.62 len 0.91 | 1 |
| sim 0.62 len 0.95 | 1 |
| sim 0.63 len 0.94 | 1 |
| sim 0.64 len 0.63 | 1 |
| sim 0.64 len 0.79 | 1 |
| sim 0.64 len 0.89 | 1 |
| sim 0.66 len 0.91 | 1 |
| sim 0.66 len 0.99 | 1 |
| sim 0.67 len 0.77 | 1 |
| sim 0.67 len 0.88 | 1 |
| sim 0.67 len 0.96 | 1 |
| sim 0.69 len 0.97 | 1 |
| sim 0.72 len 0.70 | 1 |
| sim 0.74 len 0.84 | 1 |
| sim 0.74 len 0.99 | 1 |
| sim 0.76 len 0.82 | 1 |
| sim 0.77 len 0.60 | 1 |
| sim 0.78 len 0.48 | 1 |
| sim 0.79 len 0.74 | 1 |
| sim 0.80 len 0.72 | 1 |
| sim 0.80 len 0.77 | 1 |
| sim 0.80 len 0.98 | 1 |
| sim 0.81 len 0.78 | 1 |
| sim 0.81 len 0.82 | 1 |
| sim 0.82 len 0.82 | 1 |
| sim 0.82 len 0.97 | 1 |
| sim 0.83 len 0.91 | 1 |
| sim 0.84 len 0.63 | 1 |
| sim 0.84 len 0.95 | 1 |
| sim 0.85 len 0.56 | 1 |
| sim 0.86 len 0.76 | 1 |
| sim 0.86 len 0.89 | 1 |
| sim 0.87 len 0.72 | 1 |
| sim 0.87 len 0.89 | 1 |
| sim 0.87 len 1.00 | 1 |
| sim 0.88 len 0.92 | 1 |
| sim 0.89 len 0.93 | 1 |
| sim 0.90 len 0.87 | 1 |
| sim 0.90 len 0.99 | 1 |
| sim 0.91 len 0.92 | 1 |
| sim 0.92 len 0.88 | 1 |
| sim 0.92 len 0.90 | 1 |
| sim 0.92 len 0.95 | 1 |
| sim 0.93 len 0.89 | 1 |
| sim 0.93 len 0.93 | 1 |
| sim 0.95 len 0.95 | 1 |
| sim 1.00 len 0.71 | 1 |
| sim 1.00 len 0.73 | 1 |
| sim 1.00 len 0.77 | 1 |

## Review Guidance

- Do not merge financial/versioned packs unless the CFO confirms the files are truly redundant.
- Treat translations as separate records unless the business wants a single bilingual canonical family.
- For low-similarity legal pairs, compare economics, parties, dates, schedules, signatures and amendments before superseding anything.
- This report is an input for human review; it is not an execution plan.

## Clusters

### 001 — financial-versions

Key: `005525distribucion|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 0055_25_DISTRIBUCION V3.pdf | MAD | monitoring | unknown | 85 | 9 | edd216cbb4e0d869 | 2026-04-12T13:51:40.991269+00:00 | `6531bbab-348a-47c1-9ae1-1b095de45d56` |
| 2 | 0055_25_DISTRIBUCION V4.pdf | MAD | monitoring | unknown | 85 | 7 | c7ea7365a84038c4 | 2026-04-12T13:51:38.895061+00:00 | `f3258089-90ec-405a-aead-71ad68cd93b1` |

### 002 — financial-versions

Key: `104emergesurftechnicalnote0|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 10492.01.001 Emerge Surf Technical Note V1.0.pdf | GVF | monitoring | executed | 40 | 6 | 68acb24605120cb4 | 2026-04-12T04:26:23.233032+00:00 | `28901b56-8cbd-41d3-ba8c-08e2ada16d48` |
| 2 | 10492.01.001 Emerge Surf Technical Note V1.0.docx | GVF | monitoring | working_paper | 40 | 5 | 40346f2b6165def6 | 2026-04-12T04:18:05.765391+00:00 | `6b3185a1-11d8-481b-8544-31d8d38ba037` |

### 003 — financial-versions

Key: `1068peindicedeplanos|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 1068-PE-INDICE DE PLANOS-rev01.pdf | MAD | monitoring | unknown | 85 | 21 | 9a830a429d1bed1d | 2026-04-12T14:21:58.295417+00:00 | `5f02b09d-5b7b-40fb-afa4-05b6d3b011be` |
| 2 | 1068-PE-INDICE DE PLANOS_.pdf | MAD | monitoring | unknown | 85 | 21 | ed3265910f51aab4 | 2026-04-12T14:11:50.04524+00:00 | `ed53c78b-d0b8-4be3-9056-70fd72aba6bb` |

### 004 — financial-versions

Key: `120madridplayasurfprevpagos|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 120 MADRID PLAYA SURF 082025_Prev.Pagos signed.pdf | MAD | financial_statements | executed | 90 | 3 | 347c78698586b179 | 2026-04-12T12:18:33.802171+00:00 | `5e329d19-0f05-4015-87a2-3db04157ebe7` |
| 2 | 120 MADRID PLAYA SURF 102025_Prev.Pagos.pdf | MAD | financial_statements | unknown | 90 | 3 | f5f8f73a0c7e0776 | 2026-04-12T12:18:37.123032+00:00 | `65cb1b4d-93e4-4155-8b7a-11999603e0ff` |
| 3 | 120 MADRID PLAYA SURF 092025_Prev.Pagos SIGNED.pdf | MAD | financial_statements | executed | 90 | 3 | d77981f7fd2e75c4 | 2026-04-12T12:18:35.503568+00:00 | `ac794a05-2c39-4a9a-9044-9a1a812228ff` |

### 005 — financial-versions

Key: `125usclpaymentorder|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 125 USCL 21012026_Payment Order.pdf | BHX | cash_flow | signed | 90 | 1 | 191ff9ee9e0eb976 | 2026-04-11T18:49:00.963472+00:00 | `3e7dd535-4d6f-4aed-8ba3-ee1d759ba57a` |
| 2 | 125 USCL 022025_Payment Order.pdf | BHX | cash_flow | executed | 90 | 3 | e8a148c207226f12 | 2026-04-11T18:54:02.00755+00:00 | `b0966124-a33d-4d10-a8e2-25e36771ba04` |

### 006 — financial-versions

Key: `125usclpaymentorderinvoicessgc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 125 USCL 19112025_Payment Order INVOICES signed sgc.pdf | BHX | cash_flow | signed | 90 | 61 | 1ccd78ee4f24935e | 2026-04-11T18:54:55.384941+00:00 | `9e91cabc-5031-46f0-8c94-05ff5a896dcb` |
| 2 | 125 USCL 06082025_Payment Order.INVOICES signed SGC.pdf | BHX | cash_flow | signed | 90 | 57 | 9ccb4a1b4acefa83 | 2026-04-11T18:56:11.071029+00:00 | `f532ac01-b6a8-4caf-b898-6f10005c5a77` |

### 007 — financial-versions

Key: `125usclpaymentordersgc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 125 USCL 03062025_Payment Order SGC.pdf | BHX | cash_flow | signed | 90 | 1 | d5e9b3dff086d8f9 | 2026-04-11T18:54:15.824224+00:00 | `3fb5a658-9b1a-4ccd-a106-bdfecf1f3b5e` |
| 2 | 125 USCL 022025_Payment Order SIGNED SGC.pdf | BHX | cash_flow | signed | 90 | 3 | 629e39034fa342a2 | 2026-04-11T18:53:42.615151+00:00 | `9316f4d4-999e-4230-ac53-fda0f63aab0f` |

### 008 — financial-versions

Key: `127gemswellventuresprevpagos|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 127 GEMSWELL VENTURES 03062025_Prev.Pagos.pdf | GVF | financial_statements | unknown | 85 | 2 | 2decc38446ffcbae | 2026-04-12T12:43:41.552513+00:00 | `00eafadf-815f-4c35-b321-ce9eaa99c55d` |
| 2 | 127 GEMSWELL VENTURES 23052025_Prev.Pagos.pdf | GVF | financial_statements | unknown | 85 | 1 | 88a7db08374404ca | 2026-04-12T12:43:51.968214+00:00 | `d84c534e-2624-44f0-8e47-67f184c0edbf` |

### 009 — financial-versions

Key: `127gemswellventuresprevpagosfacturas|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 127 GEMSWELL VENTURES 23052025_Prev.Pagos.FACTURAS.pdf | GVF | financial_statements | unknown | 85 | 2 | bd041135a59078d1 | 2026-04-12T12:43:50.038167+00:00 | `391d0b14-13bb-429e-b9c2-36ded10dee3c` |
| 2 | 127 GEMSWELL VENTURES 112025_Prev.Pagos FACTURAS.pdf | GVF | financial_statements | unknown | 85 | 32 | af958cf156502132 | 2026-04-12T12:43:44.624127+00:00 | `66812a48-a9ec-4ddd-b50f-fa5d2041839d` |

### 010 — financial-versions

Key: `16436hydcoxxdrc1000p01flowdiagram|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-CO-XX-DR-C-1000-P01 - Flow Diagram.pdf | BHX | capex | draft | 40 | 2 | bf17c7174e3421f7 | 2026-04-12T05:53:38.657018+00:00 | `1088d47b-8ab5-4b26-b781-4a63fa0f5445` |
| 2 | 16436-HYD-CO-XX-DR-C-1000-P01 - Flow Diagram.pdf | BHX | capex | draft | 40 | 85 | f2f475b02159d760 | 2026-04-12T05:56:02.336143+00:00 | `3fce7550-4378-4909-aa36-5fa9dd4609df` |

### 011 — financial-versions

Key: `16436hydcoxxdre8000|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-CO-XX-DR-E-8000.pdf | BHX | capex | draft | 40 | 152 | 0ac9c02c69dd12d7 | 2026-04-12T06:31:28.181038+00:00 | `c033c8d0-2a2c-4c38-ad83-8960a322cc5f` |
| 2 | 16436-HYD-CO-XX-DR-E-8000.pdf | BHX | capex | draft | 40 | 2 | 0f7670ef9e5aebde | 2026-04-12T06:31:34.790259+00:00 | `f8e5dea2-bb30-4b13-8261-1b137a3ff6e6` |

### 012 — financial-versions

Key: `16436hydcozzsks2007|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-CO-ZZ-SK-S-2007.pdf | BHX | capex | working_paper | 40 | 3 | 5d251e6a3cfbeff8 | 2026-04-12T07:46:14.5771+00:00 | `108b4f72-9a8f-4dc7-a85f-d494121cb5fd` |
| 2 | 16436-HYD-CO-ZZ-SK-S-2007.pdf | BHX | other | executed | 40 | 4 | 553aa06aefb10b0d | 2026-04-12T07:46:24.5337+00:00 | `b7eddd02-6556-4a97-90bb-5b49a063ec26` |

### 013 — financial-versions

Key: `16436hydcozzsks2014|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-CO-ZZ-SK-S-2014.pdf | BHX | capex | working_paper | 40 | 3 | e2b3b798e32232e2 | 2026-04-12T07:48:56.595394+00:00 | `85f303a0-a151-46cc-8397-45e08aa0835a` |
| 2 | 16436-HYD-CO-ZZ-SK-S-2014.pdf | BHX | capex | working_paper | 40 | 3 | 87005f0d1290fa05 | 2026-04-12T07:49:47.944491+00:00 | `ae386ba5-5ff2-400c-bded-f86018ac2f70` |

### 014 — financial-versions

Key: `16436hydsyzzdrs1150|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-SY-ZZ-DR-S-1150.pdf | BHX | capex | draft | 40 | 1 | e54420827376b1e5 | 2026-04-12T07:51:44.868244+00:00 | `0e3560ee-4687-4dcc-90f9-f466d3ec7d83` |
| 2 | 16436-HYD-SY-ZZ-DR-S-1150.pdf | BHX | asset_management | working_paper | 40 | 15 | 29073f310adf557b | 2026-04-12T07:51:25.046204+00:00 | `c07e1bf2-6d58-4a30-93f9-1c17348f5b59` |

### 015 — financial-versions

Key: `16436hydth00drm2001|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-00-DR-M-2001.pdf | BHX | other | draft | 40 | 4 | 8ed6f938b6d25826 | 2026-04-12T06:53:01.670397+00:00 | `b17f14f2-9ad0-4a8b-9df6-2fd5f138a362` |
| 2 | 16436-HYD-TH-00-DR-M-2001.pdf | BHX | capex | draft | 40 | 4 | 365f721adfbc08c5 | 2026-04-12T06:53:04.841444+00:00 | `ffdfd7c8-3d8f-4498-8c6d-8a3d404bd631` |

### 016 — financial-versions

Key: `16436hydthf1drs1005|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-F1-DR-S-1005.pdf | BHX | capex | executed | 40 | 2 | 5c0d3781905f0506 | 2026-04-12T08:06:35.111327+00:00 | `40083262-d471-4871-aa41-9b72bb5ee4e3` |
| 2 | 16436-HYD-TH-F1-DR-S-1005.pdf | BHX | other | executed | 40 | 3 | 3a4e3df6394103a5 | 2026-04-12T08:06:22.541714+00:00 | `90075720-66ee-4d11-a307-6b9149887a96` |

### 017 — financial-versions

Key: `16436hydxxxxdrc0200draindownsection|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-XX-XX-DR-C-0200 Drain down Section.pdf | BHX | other | draft | 40 | 3 | 6e3d3819d4a83776 | 2026-04-12T05:57:03.98321+00:00 | `683ad707-81dc-4807-956b-cec5750f0a15` |
| 2 | 16436-HYD-XX-XX-DR-C-0200 Drain down Section.pdf | BHX | capex | draft | 40 | 2 | 7896af6e3aff2e4a | 2026-04-12T05:57:08.913778+00:00 | `bb25e121-de09-4b06-a27e-95f45e48decd` |

### 018 — financial-versions

Key: `16436hydxxxxdrc0609p02enablingdrainagelayout|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-XX-XX-DR-C-0609-P02 Enabling Drainage Layout.pdf | BHX | capex | draft | 40 | 3 | 0242c9a7fe75ee2e | 2026-04-12T06:05:49.570707+00:00 | `2cf92b33-5882-46a2-97a5-df0cc6428206` |
| 2 | 16436-HYD-XX-XX-DR-C-0609-P02 Enabling Drainage Layout.pdf | BHX | capex | draft | 40 | 3 | c49ae22c8dac5e9b | 2026-04-12T06:05:38.092978+00:00 | `c30eba00-ba1b-498d-b914-84fa298ac697` |

### 019 — financial-versions

Key: `16436hydxxxxdrme8004|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-XX-XX-DR-ME-8004.pdf | BHX | capex | draft | 40 | 1 | 51ef9fed5e5a8e99 | 2026-04-12T06:50:54.98916+00:00 | `0c554a6e-94e7-492b-a8b0-8d808ee1b679` |
| 2 | 16436-HYD-XX-XX-DR-ME-8004.pdf | BHX | capex | draft | 40 | 3 | b45ecded8c37b713 | 2026-04-12T06:51:52.014061+00:00 | `589dde1a-37b2-4cca-bdd6-a86ad9974142` |

### 020 — financial-versions

Key: `16436hydxxxxtnme0001|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-XX-XX-TN-ME-0001.pdf | BHX | capex | executed | 40 | 17 | 9ef5cfec602f0bdb | 2026-04-12T06:50:28.622107+00:00 | `18eaea89-19c1-4794-abfa-14d43e5eecae` |
| 2 | 16436-HYD-XX-XX-TN-ME-0001.pdf | BHX | capex | executed | 40 | 23 | 56c0469e348723c1 | 2026-04-12T04:31:42.956578+00:00 | `ae4b5316-3614-4676-a462-302b412ffd5a` |
| 3 | 16436-HYD-XX-XX-TN-ME-0001.pdf | BHX | capex | executed | 40 | 385 | bd3c9f8dd603943b | 2026-04-12T04:40:53.0978+00:00 | `ff0d5e98-8d70-44aa-9af0-fb28ebf0b486` |

### 021 — financial-versions

Key: `2010ahp00120groundfloorplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-P-00-120-GroundFloorPlan.pdf | BHX | other | executed | 40 | 1 | 35ae8e82b16bbd7a | 2026-04-12T04:00:53.864568+00:00 | `2aca90c6-14b3-4fa1-a6bf-c68cf70a508a` |
| 2 | 2010-A-H-P-00-120-GroundFloorPlan.pdf | BHX | capex | executed | 40 | 1 | b4f88a844066ba34 | 2026-04-12T04:15:38.722384+00:00 | `b3c3b845-2443-48a3-9204-ed28091726fe` |

### 022 — financial-versions

Key: `2010ahp00122groundfloorplan01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-P-00-122-GroundFloorPlan-01.pdf | BHX | capex | working_paper | 40 | 2 | 7e4d1c1f0af812e7 | 2026-04-12T04:14:14.155872+00:00 | `47fdf792-3576-467b-8475-60b940032f82` |
| 2 | 2010-A-H-P-00-122-GroundFloorPlan-01.pdf | BHX | capex | working_paper | 40 | 3 | ceda5dcee2aa5478 | 2026-04-12T04:24:24.886476+00:00 | `4d6182ea-f9a9-4561-a9b3-ffdb5ae22423` |

### 023 — financial-versions

Key: `2010ahp00123groundfloorplan02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-P-00-123-GroundFloorPlan-02.pdf | BHX | other | draft | 40 | 1 | d9e731454607b7cf | 2026-04-12T04:01:42.749567+00:00 | `2bfc0209-a604-4dd2-9dd9-c2be75215284` |
| 2 | 2010-A-H-P-00-123-GroundFloorPlan-02.pdf | BHX | capex | working_paper | 40 | 1 | 1fe22f28a9e8bbda | 2026-04-12T04:15:10.914771+00:00 | `5e25ff78-1378-4722-8882-3f346f79375e` |

### 024 — financial-versions

Key: `2010ahprf121roofplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-P-RF-121-RoofPlan.pdf | BHX | capex | executed | 40 | 1 | e09ecc0b7bb92db7 | 2026-04-12T04:15:24.481997+00:00 | `086cbf14-1cb0-41a7-8c59-133b227dc287` |
| 2 | 2010-A-H-P-RF-121-RoofPlan.pdf | BHX | capex | working_paper | 40 | 1 | df09419e769064a9 | 2026-04-12T04:01:09.520923+00:00 | `a7a68750-4f3c-4e15-89c3-f6a8ac2039d4` |

### 025 — financial-versions

Key: `2010amhcxx010doorschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-010-DoorSchedule-01.pdf | BHX | capex | draft | 40 | 3 | 80621f6a38f485de | 2026-04-12T01:37:14.022585+00:00 | `e27f5cdf-08d0-4782-a3a7-1e4c23340c16` |
| 2 | 2010-A-MH-C-xx-010-DoorSchedule-01.pdf | BHX | capex | draft | 40 | 3 | 45260d737f7146ff | 2026-04-12T10:23:19.710301+00:00 | `f567e504-da43-44c0-ba52-8462e9f7dc24` |

### 026 — financial-versions

Key: `2010amhcxx011doorschedule02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-011-DoorSchedule-02.pdf | BHX | capex | draft | 40 | 3 | 3d50f0f932e9c331 | 2026-04-12T10:24:06.844726+00:00 | `2d84ea1d-0274-40fb-bb34-8415dd1359ac` |
| 2 | 2010-A-MH-C-xx-011-DoorSchedule-02.pdf | BHX | other | draft | 40 | 3 | d702d4e0f0845949 | 2026-04-12T01:37:38.535148+00:00 | `6d1844ff-7304-4481-83c2-7884f2053412` |

### 027 — financial-versions

Key: `2010amhcxx103internaldoorschedule04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-103-InternalDoorSchedule-04.pdf | BHX | other | draft | 40 | 3 | a2a0083d272b10f5 | 2026-04-12T10:25:31.419606+00:00 | `ae5e34d6-f1c0-4555-a209-a8323fc2a4a9` |
| 2 | 2010-A-MH-C-xx-103-InternalDoorSchedule-04.pdf | BHX | other | draft | 40 | 3 | 734f1ed36e33ad97 | 2026-04-12T01:38:47.459046+00:00 | `b9f8f5ea-be82-4ddf-a467-98caef7a147e` |
| 3 | 2010-A-MH-C-xx-103-InternalDoorSchedule-04.pdf | BHX | capex | draft | 40 | 3 | 82bccf1354246060 | 2026-04-12T10:25:39.675898+00:00 | `bda986d3-3479-4ae4-ace4-8ccc03496fa8` |

### 028 — financial-versions

Key: `2010amhdxx001floorbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-001-FloorBuildups.pdf | BHX | capex | draft | 40 | 2 | e8805f54d81fb780 | 2026-04-12T09:57:19.901277+00:00 | `15a866f2-9b9f-4830-961e-94b5deba4337` |
| 2 | 2010-A-MH-D-xx-001-FloorBuildups.pdf | BHX | capex | draft | 40 | 2 | 6b7200f43618d912 | 2026-04-12T01:09:44.150586+00:00 | `360d1ca8-2539-4c34-ba71-cf44bef3d70c` |

### 029 — financial-versions

Key: `2010amhdxx005externalwallbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-005-ExternalWallBuildups.pdf | BHX | other | draft | 40 | 3 | ddf5e567dab023b1 | 2026-04-12T09:57:42.255608+00:00 | `62c40814-e3ab-4777-865d-79e1a880fd05` |
| 2 | 2010-A-MH-D-xx-005-ExternalWallBuildups.pdf | BHX | capex | working_paper | 40 | 4 | e31012a4f6fabf68 | 2026-04-12T01:10:13.863631+00:00 | `c8d11afd-de46-48ea-99c3-42f44c9af7e5` |

### 030 — financial-versions

Key: `2010amhdxx020roofbuildup|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-020-RoofBuildup.pdf | BHX | capex | draft | 40 | 1 | 5602e28255768454 | 2026-04-12T01:11:41.388633+00:00 | `3d2b1736-2b71-47e1-be7d-86ccc6ecd1c3` |
| 2 | 2010-A-MH-D-xx-020-RoofBuildup.pdf | BHX | other | draft | 40 | 1 | 2cf9b5870daa7de9 | 2026-04-12T09:58:21.119782+00:00 | `ab4da64c-4112-4414-8e77-b4d7b4e31d59` |

### 031 — financial-versions

Key: `2010amhdxx041plandetailcorner|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-041-PlanDetail-Corner.pdf | BHX | other | draft | 40 | 1 | 95cce58a59a42f6a | 2026-04-12T01:11:28.126716+00:00 | `1acd6b5f-838d-46db-8dcd-0c53bb4037d1` |
| 2 | 2010-A-MH-D-xx-041-PlanDetail-Corner.pdf | BHX | other | draft | 40 | 1 | 10c72ecd6224e9f3 | 2026-04-12T09:59:25.141238+00:00 | `6783d5ed-0119-4a3c-8f02-d515e2f2e6ee` |
| 3 | 2010-A-MH-D-xx-041-PlanDetail-Corner.pdf | BHX | capex | draft | 40 | 1 | 006865eee8d74e3b | 2026-04-12T09:59:27.896596+00:00 | `6ffb6695-6fec-40de-b25c-3d18214a24c9` |

### 032 — financial-versions

Key: `2010amhdxx045eavesdetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-045-EavesDetail.pdf | BHX | other | draft | 40 | 1 | 9666c14bf1f299ce | 2026-04-12T09:59:11.508417+00:00 | `0d77f1fd-9f56-4c0a-9b1c-a6614cd3fe42` |
| 2 | 2010-A-MH-D-xx-045-EavesDetail.pdf | BHX | capex | draft | 40 | 1 | a7536b06f12e0285 | 2026-04-12T01:13:02.574787+00:00 | `c8b7b1f4-8dfe-46e7-8dcc-bdf71e427f3d` |

### 033 — financial-versions

Key: `2010amhdxx046ridgedetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-046-RidgeDetail.pdf | BHX | other | draft | 40 | 1 | da0347f31d87b42d | 2026-04-12T09:59:55.770164+00:00 | `582e7ad2-728d-4180-a0b0-c1eb9fbb7ba9` |
| 2 | 2010-A-MH-D-xx-046-RidgeDetail.pdf | BHX | capex | draft | 40 | 1 | 0bbfd3fd5863c23d | 2026-04-12T01:12:49.097862+00:00 | `841ee812-46d9-44b4-a723-9b7bf0b74a64` |

### 034 — financial-versions

Key: `2010amhdxx050glazeddoorbase|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-050-GlazedDoorBase.pdf | BHX | capex | draft | 40 | 1 | f566c6eee2a94036 | 2026-04-12T09:59:42.446956+00:00 | `a4e246f7-ae81-42ee-a66e-6903d8c45691` |
| 2 | 2010-A-MH-D-xx-050-GlazedDoorBase.pdf | BHX | other | draft | 40 | 1 | fb577f022eab152c | 2026-04-12T01:12:35.791599+00:00 | `cd7565c0-0ca9-41e9-8618-e7e69800c63c` |

### 035 — financial-versions

Key: `2010amhdxx051glazeddoorhead|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-051-GlazedDoorHead.pdf | BHX | capex | draft | 40 | 1 | 3dff0346da7fc902 | 2026-04-12T01:13:15.97569+00:00 | `6cc0f8c9-55ae-48fe-8abc-2eb1f396dec7` |
| 2 | 2010-A-MH-D-xx-051-GlazedDoorHead.pdf | BHX | other | draft | 40 | 1 | 45df9a270ae94719 | 2026-04-12T09:59:58.162301+00:00 | `fed4322f-1e6a-430f-b963-57470a416c5e` |

### 036 — financial-versions

Key: `2010amhdxx061typicalrollerdoorhead|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-061-TypicalRollerDoorHead.pdf | BHX | capex | draft | 40 | 1 | 2df36f4eb88286eb | 2026-04-12T01:13:30.384144+00:00 | `b1a59657-b3f0-488e-b608-8a9728702bea` |
| 2 | 2010-A-MH-D-xx-061-TypicalRollerDoorHead.pdf | BHX | capex | draft | 40 | 2 | 83ab57f651d5721c | 2026-04-12T10:00:29.330321+00:00 | `ba947638-12a9-4d8d-ac9f-f41a24882043` |

### 037 — financial-versions

Key: `2010amhdxx107partitionsections03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-107-PartitionSections-03.pdf | BHX | capex | draft | 40 | 1 | f8b50fac3a661c81 | 2026-04-12T10:02:05.808655+00:00 | `32626686-77ed-4a40-931a-65bbdc684b54` |
| 2 | 2010-A-MH-D-xx-107-PartitionSections-03.pdf | BHX | other | draft | 40 | 2 | ee9716f6cd50acc7 | 2026-04-12T01:14:52.021393+00:00 | `664ca911-72e5-4486-a87e-0ba992402fc3` |

### 038 — financial-versions

Key: `2010amhdxx108partitionsections04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-108-PartitionSections-04.pdf | BHX | capex | draft | 40 | 2 | bf5edb6b324122bf | 2026-04-12T01:15:32.57583+00:00 | `42238b74-b19c-4675-b218-036333f466b0` |
| 2 | 2010-A-MH-D-xx-108-PartitionSections-04.pdf | BHX | other | draft | 40 | 1 | ef942f59e9933dec | 2026-04-12T10:01:38.655197+00:00 | `d63f80e7-6a9b-4dfc-9ebc-87afabec5917` |

### 039 — financial-versions

Key: `2010amhdxx115partitionplans01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-115-PartitionPlans-01.pdf | BHX | capex | draft | 40 | 1 | c9a10278f5dbbfbc | 2026-04-12T10:01:59.389262+00:00 | `897abca4-92c8-4feb-9d03-30cc71bb00b7` |
| 2 | 2010-A-MH-D-xx-115-PartitionPlans-01.pdf | BHX | capex | draft | 40 | 1 | e2b10635cc47ef85 | 2026-04-12T01:16:27.350106+00:00 | `df8fd029-37f2-4e7f-95fa-c8b091a5b77e` |

### 040 — financial-versions

Key: `2010amhdxx116partitionplans02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-116-PartitionPlans-02.pdf | BHX | other | draft | 40 | 1 | 7f9c67ef097aa99e | 2026-04-12T01:16:13.849399+00:00 | `454ff5a0-9c83-4a8a-85d1-042182286d60` |
| 2 | 2010-A-MH-D-xx-116-PartitionPlans-02.pdf | BHX | capex | draft | 40 | 1 | 14f92dc2cde40120 | 2026-04-12T10:02:37.734935+00:00 | `5d3c5bc2-6f12-400b-a538-0059c9153566` |

### 041 — financial-versions

Key: `2010amhdxx205changingwc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-205-ChangingWC.pdf | BHX | capex | draft | 40 | 1 | b82907e43d91108d | 2026-04-12T01:17:35.389917+00:00 | `ec8be85a-00e5-4b40-98ec-b6251d03da39` |
| 2 | 2010-A-MH-D-XX-205-ChangingWC.pdf | BHX | capex | draft | 40 | 1 | 035b67301c5e1afb | 2026-04-12T09:57:02.121706+00:00 | `f36260bf-1869-4c99-aea3-43ee60985950` |

### 042 — financial-versions

Key: `2010amhp00105buildupsplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-P-00-105-BuildupsPlan.pdf | BHX | capex | draft | 40 | 1 | ebc5b76161c5a23d | 2026-04-12T08:48:13.542989+00:00 | `e23d36f2-6de2-4ba3-a0d3-79fecba929c5` |
| 2 | 2010-A-MH-P-00-105-BuildupsPlan.pdf | BHX | capex | draft | 40 | 1 | 75c6301c79382a31 | 2026-04-12T03:24:44.289731+00:00 | `ff8431b8-e83d-4928-bba7-c3717e252f73` |

### 043 — financial-versions

Key: `2010amhp00110reflectedceilingplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-P-00-110-ReflectedCeilingPlan.pdf | BHX | other | draft | 40 | 2 | 49469c18b5075a80 | 2026-04-12T08:47:55.098413+00:00 | `171bd53c-a0af-4298-8bd5-24066b4b5361` |
| 2 | 2010-A-MH-P-00-110-ReflectedCeilingPlan.pdf | BHX | capex | working_paper | 40 | 1 | 10d259372744e07a | 2026-04-12T03:25:36.012177+00:00 | `5010faec-30c6-4158-906f-622eebf24d82` |

### 044 — financial-versions

Key: `2010amhsch01sanitaryware|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-Sch01-Sanitaryware.pdf | BHX | capex | draft | 40 | 7 | 9de00c0c525409ee | 2026-04-11T23:18:22.39218+00:00 | `5dc4849c-c962-4fc8-8e72-208442c6a62b` |
| 2 | 2010-A-MH-Sch01-Sanitaryware.pdf | BHX | capex | draft | 40 | 28 | a610c55c5a94acba | 2026-04-11T23:15:20.390699+00:00 | `9613de6b-0cd1-4254-b42e-856d6e8d9e77` |

### 045 — financial-versions

Key: `2010ampxx101masterplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-M-P-xx-101-Masterplan.pdf | BHX | general | executed | 40 | 2 | afa573c2f70f8cc2 | 2026-04-12T04:16:59.2737+00:00 | `881f1f90-1c88-4264-a7ba-b6c959bfd4ae` |
| 2 | 2010-A-M-P-xx-101-Masterplan.pdf | BHX | capex | working_paper | 40 | 2 | 00b3f3370564f6e8 | 2026-04-12T04:09:33.557062+00:00 | `9070599c-34fb-4c61-9d56-db994eed2dc6` |
| 3 | 2010-A-M-P-xx-101-Masterplan.pdf | BHX | capex | draft | 40 | 1 | 90df58d94d77cfd6 | 2026-04-11T22:31:38.798964+00:00 | `a9230af0-6f4d-40ff-abca-eb34d40e9575` |

### 046 — financial-versions

Key: `2010ampxx102masterplanlandscapefinishes|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-M-P-xx-102-MasterplanLandscapeFinishes.pdf | BHX | capex | draft | 40 | 2 | 727e3554d360d19c | 2026-04-12T04:08:59.850224+00:00 | `80abf52f-e92a-4e08-86ca-19b7efed1412` |
| 2 | 2010-A-M-P-xx-102-MasterplanLandscapeFinishes.pdf | BHX | other | draft | 40 | 1 | fb205290c433f152 | 2026-04-11T22:29:47.419304+00:00 | `e2e81f91-eceb-4abf-a168-d2675938b047` |
| 3 | 2010-A-M-P-xx-102-MasterplanLandscapeFinishes.pdf | BHX | other | executed | 40 | 1 | 0a853ff278ca8135 | 2026-04-12T04:16:26.086503+00:00 | `e841b46b-472a-49a1-9e43-66435a5f9aba` |

### 047 — financial-versions

Key: `2010apadxx010internalwallbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-010-Internal Wall Buildups .pdf | BHX | capex | draft | 40 | 3 | 706952cb29e3b4bf | 2026-04-12T01:18:22.352542+00:00 | `8e42291f-333c-41be-b03f-148599406b56` |
| 2 | 2010-A-PA-D-xx-010-Internal Wall Buildups .pdf | BHX | other | draft | 40 | 3 | 48f1f17dc50244ca | 2026-04-12T10:04:40.825431+00:00 | `b5c935f5-3b2a-404d-939d-3c82312ee880` |

### 048 — financial-versions

Key: `2010apadxx015roofbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-015-Roof Buildups .pdf | BHX | capex | draft | 40 | 1 | c8509a93eeb78527 | 2026-04-12T01:19:02.123586+00:00 | `9e710719-2a7c-4c85-88ec-5b1af5ab31a7` |
| 2 | 2010-A-PA-D-xx-015-Roof Buildups .pdf | BHX | capex | draft | 40 | 1 | d75ac797c556fbf7 | 2026-04-12T10:04:45.27227+00:00 | `b30a1cb1-f97f-4229-87e7-0f368c1a3c1a` |

### 049 — financial-versions

Key: `2010apadxx040lockerdetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-040-LockerDetail.pdf | BHX | other | draft | 40 | 2 | 45e9da10f758bc91 | 2026-04-12T10:05:59.513691+00:00 | `3287ec5f-7eda-49ae-ac55-0f1ed95d79e1` |
| 2 | 2010-A-PA-D-xx-040-LockerDetail.pdf | BHX | capex | draft | 40 | 2 | 116301fb7151a4ed | 2026-04-12T01:20:24.117824+00:00 | `5ffa98b5-367a-4885-b029-424d084e510b` |
| 3 | 2010-A-PA-D-xx-040-LockerDetail.pdf | BHX | other | draft | 40 | 2 | c2c7c3a0e2cd98c9 | 2026-04-12T10:05:54.613963+00:00 | `d9ee073d-613e-4c60-896c-4235164c6c1f` |

### 050 — financial-versions

Key: `2010apadxx051accessibleshowerchangedoordetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-051-AccessibleShower&ChangeDoorDetail.pdf | BHX | capex | draft | 40 | 1 | 5846e8850547a6fd | 2026-04-12T01:21:18.803716+00:00 | `6a147387-8655-4a3e-9ee3-dca7533eac0b` |
| 2 | 2010-A-PA-D-xx-051-AccessibleShower&ChangeDoorDetail.pdf | BHX | other | draft | 40 | 1 | 350e7be1bbad1afd | 2026-04-12T10:05:44.194595+00:00 | `a55c887e-04b1-4955-9323-bd0a3a940926` |

### 051 — financial-versions

Key: `2010apadxx055surfboardstoragedoor|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-055-SurfboardStorageDoor.pdf | BHX | capex | draft | 40 | 2 | 8875db9932481dcb | 2026-04-12T10:06:32.197571+00:00 | `84545fa5-f440-44fb-b1cb-0f5b332f7f88` |
| 2 | 2010-A-PA-D-xx-055-SurfboardStorageDoor.pdf | BHX | capex | draft | 40 | 2 | 9270479988bfbde8 | 2026-04-12T01:22:14.353354+00:00 | `b3f439c8-46cf-46c2-9bf9-aa35dd24ae8e` |

### 052 — financial-versions

Key: `2010apadxx200detailedroomdiabledshower|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-200-DetailedRoom-DiabledShower.pdf | BHX | capex | draft | 40 | 1 | 8591544d47932772 | 2026-04-12T01:22:00.595327+00:00 | `0d5a038b-6b7e-4c43-8d57-dc05a99a6c58` |
| 2 | 2010-A-PA-D-XX-200-DetailedRoom-DiabledShower.pdf | BHX | other | draft | 40 | 1 | 7839b41801930190 | 2026-04-12T10:03:29.294295+00:00 | `77cf18c8-2331-4df0-9304-2e41f65544bd` |

### 053 — financial-versions

Key: `2010apadxx215detailedroomoutsideshower|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-215-DetailedRoom-OutsideShower.pdf | BHX | other | draft | 40 | 1 | 59acbdf3e6b0d269 | 2026-04-12T01:22:27.952599+00:00 | `2fe0c759-76e7-470d-9d12-16554f437ce1` |
| 2 | 2010-A-PA-D-XX-215-DetailedRoom-OutsideShower.pdf | BHX | capex | draft | 40 | 1 | 01eaf837bb413d27 | 2026-04-12T10:03:55.952636+00:00 | `a91de8a9-bfdf-4758-913f-d8fe35284ef3` |

### 054 — financial-versions

Key: `2010apae200elevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-E-200-Elevations.pdf | BHX | capex | working_paper | 40 | 1 | f54029d39c5f2b11 | 2026-04-12T08:48:42.13913+00:00 | `a857adc3-f4ce-4da6-ae8c-04c9f1d2ec31` |
| 2 | 2010-A-PA-E-200-Elevations.pdf | BHX | capex | working_paper | 40 | 1 | 2391184e099c8721 | 2026-04-12T03:26:47.649634+00:00 | `fd4038af-6f29-42ce-a83d-6f1bf88b1cba` |

### 055 — financial-versions

Key: `2010apaexx200practiceareaelevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-E-xx-200-PracticeAreaElevations.pdf | BHX | other | executed | 40 | 1 | c5707e03c3e7f0a0 | 2026-04-12T04:10:01.375859+00:00 | `43a76cd6-ec1c-4bae-a6a0-409470f5e2e8` |
| 2 | 2010-A-PA-E-xx-200-PracticeAreaElevations.pdf | BHX | capex | executed | 40 | 1 | cb83587657a4bf91 | 2026-04-12T04:17:26.628289+00:00 | `c2f4e580-9a98-498a-ba67-80cfc6fb6558` |

### 056 — financial-versions

Key: `2010apap00160changingroomsfloorbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-00-160-ChangingRooms-FloorBuildups.pdf | BHX | other | draft | 40 | 1 | 5b816c5dcecb9745 | 2026-04-12T08:49:29.75822+00:00 | `ae5e2ae8-1f38-46fe-be7a-fb128a23b347` |
| 2 | 2010-A-PA-P-00-160-ChangingRooms-FloorBuildups.pdf | BHX | capex | draft | 40 | 1 | 2043659c9fbbb927 | 2026-04-12T08:49:31.088451+00:00 | `b1a691d8-7c4e-489e-91a9-b5dc71867ed4` |
| 3 | 2010-A-PA-P-00-160-ChangingRooms-FloorBuildups.pdf | BHX | other | draft | 40 | 3 | 46c4622d79d7280b | 2026-04-12T03:29:00.561253+00:00 | `b5980c6d-1bca-425c-8cad-2703afbf22b5` |

### 057 — financial-versions

Key: `2010apap00170changingroomsdrainage|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-00-170-ChangingRooms-Drainage.pdf | BHX | capex | draft | 40 | 1 | 24982968aa3a0231 | 2026-04-12T03:28:14.142411+00:00 | `0ec2c8f8-adb3-4203-8699-c2da6b4c7cba` |
| 2 | 2010-A-PA-P-00-170-ChangingRooms-Drainage.pdf | BHX | other | draft | 40 | 1 | 9ad97fdb89fe8d9d | 2026-04-12T08:49:12.132254+00:00 | `d50d7c9a-80aa-4dc5-8217-88d76d858e68` |

### 058 — financial-versions

Key: `2010apaprf151changingroomsroofplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-RF-151-ChangingRooms-RoofPlan.pdf | BHX | capex | draft | 40 | 1 | fa72e9a91b047f81 | 2026-04-12T08:50:20.779909+00:00 | `06a5e1cc-1199-49f0-b2ff-95d48bcdef81` |
| 2 | 2010-A-PA-P-RF-151-ChangingRooms-RoofPlan.pdf | BHX | capex | working_paper | 10 | 1 | b2d51bdc33b633f8 | 2026-04-12T03:30:01.571377+00:00 | `755fb125-ae4c-4eee-9e14-741b0f2c2d2b` |

### 059 — financial-versions

Key: `2010apaprf162changingroomsroofbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-RF-162-ChangingRooms-RoofBuildups.pdf | BHX | capex | draft | 40 | 1 | b2c786ca27d729db | 2026-04-12T08:50:47.458015+00:00 | `cbb4e6ee-e44b-47e3-b6b2-e0476e44f7c7` |
| 2 | 2010-A-PA-P-RF-162-ChangingRooms-RoofBuildups.pdf | BHX | capex | draft | 40 | 1 | 5e263d77c4abf54f | 2026-04-12T03:31:51.841578+00:00 | `f21a32c3-14d7-434b-b99c-24760b47ad35` |

### 060 — financial-versions

Key: `2010apaprf171changingroomsdrainage|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-RF-171-ChangingRooms-Drainage.pdf | BHX | other | draft | 40 | 1 | 921765b9bf8c7ebd | 2026-04-12T08:49:44.363287+00:00 | `1a9759c1-b5e7-4314-87ba-5dbee7723213` |
| 2 | 2010-A-PA-P-RF-171-ChangingRooms-Drainage.pdf | BHX | capex | draft | 40 | 1 | c35d7a76a2eb4869 | 2026-04-12T03:31:32.749828+00:00 | `ab07e128-204c-4dd6-839f-a5887e6efdb4` |

### 061 — financial-versions

Key: `2010apas300sections01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-S-300-Sections 01.pdf | BHX | capex | working_paper | 40 | 1 | 1f0cf814e1a53797 | 2026-04-12T08:50:33.260904+00:00 | `363dc5e5-edee-4c88-9e52-a354f2f0fe4a` |
| 2 | 2010-A-PA-S-300-Sections 01.pdf | BHX | capex | draft | 40 | 1 | a577cdd64e9b7ac8 | 2026-04-12T03:30:38.431421+00:00 | `d8196fbf-2842-4839-86bc-640d39e62d89` |

### 062 — financial-versions

Key: `2010ashcxx003glazingschedule03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-003-GlazingSchedule-03.pdf | BHX | capex | draft | 40 | 3 | fade1d396cec35f4 | 2026-04-12T10:25:11.303058+00:00 | `4ff71eb6-88c9-4807-85f5-6e9d56865745` |
| 2 | 2010-A-SH-C-xx-003-GlazingSchedule-03.pdf | BHX | other | draft | 40 | 3 | d4bbf7e408bdc924 | 2026-04-12T01:23:01.071536+00:00 | `c42a69a8-2c26-4db9-a1e3-8a5f83f309db` |

### 063 — financial-versions

Key: `2010ashcxx005glazingschedule05|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-005-GlazingSchedule-05.pdf | BHX | other | draft | 40 | 3 | b3ff59e44e833306 | 2026-04-12T10:27:08.018274+00:00 | `0f286dfc-255e-4d16-9787-d41bf13fd030` |
| 2 | 2010-A-SH-C-xx-005-GlazingSchedule-05.pdf | BHX | capex | draft | 40 | 2 | 3d734494894714a8 | 2026-04-12T01:24:47.591562+00:00 | `1636aa4d-5cc8-4954-988e-841881f5ae9e` |

### 064 — financial-versions

Key: `2010ashcxx006glazingschedule06|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-006-GlazingSchedule-06.pdf | BHX | capex | draft | 40 | 5 | de095387a195315c | 2026-04-12T10:26:48.576246+00:00 | `249a4385-c657-440e-ab6b-c9e4ded65c11` |
| 2 | 2010-A-SH-C-xx-006-GlazingSchedule-06.pdf | BHX | capex | draft | 40 | 5 | 2084d5c393061f8f | 2026-04-12T01:24:34.205301+00:00 | `9fadf266-6688-4fd7-9aca-79bd18ddf2d7` |
| 3 | 2010-A-SH-C-xx-006-GlazingSchedule-06.pdf | BHX | other | draft | 40 | 542 | 84f7efa104a29c7e | 2026-04-12T10:36:46.662417+00:00 | `c489799d-a97e-4028-8b69-552a3c23f3e6` |

### 065 — financial-versions

Key: `2010ashcxx020internalscreenschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-020-InternalScreenSchedule-01.pdf | BHX | capex | draft | 40 | 4 | 5c78856a398a13b1 | 2026-04-12T01:26:26.953951+00:00 | `809480d2-436e-4789-bba9-d3fe137b7052` |
| 2 | 2010-A-SH-C-xx-020-InternalScreenSchedule-01.pdf | BHX | other | draft | 40 | 3 | 68e1eeb3401bcd8f | 2026-04-12T10:27:22.081285+00:00 | `8829068b-3024-43dd-a832-ef82f8800d78` |

### 066 — financial-versions

Key: `2010ashcxx100internaldoorelevations01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-100-InternalDoorElevations-01.pdf | BHX | other | working_paper | 40 | 14 | f1be112d62740028 | 2026-04-12T01:26:06.978333+00:00 | `579a60c3-237a-4414-8150-d8e704cd347f` |
| 2 | 2010-A-SH-C-xx-100-InternalDoorElevations-01.pdf | BHX | capex | draft | 40 | 6 | 7489c384dc23f20c | 2026-04-12T10:29:00.276806+00:00 | `64de7267-9738-4691-bbc8-a00f0c90f008` |

### 067 — financial-versions

Key: `2010ashcxx103internaldoorelevations04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-103-InternalDoorElevations-04.pdf | BHX | capex | draft | 40 | 3 | 0c75551310c733f1 | 2026-04-12T10:28:14.440671+00:00 | `2e4312d1-8479-4ea3-803c-36b90965a21f` |
| 2 | 2010-A-SH-C-xx-103-InternalDoorElevations-04.pdf | BHX | other | draft | 40 | 3 | fa48693c2eaed682 | 2026-04-12T01:26:46.083285+00:00 | `cb3d8d09-e4f3-42e5-bee9-e0fc167f0d6b` |

### 068 — financial-versions

Key: `2010ashcxx107internaldoorelevations08|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-107-InternalDoorElevations-08.pdf | BHX | other | working_paper | 40 | 3 | 283ff596f58196dd | 2026-04-12T10:29:42.569002+00:00 | `bfdbd6f4-1726-442d-a551-ce388ef7d97e` |
| 2 | 2010-A-SH-C-xx-107-InternalDoorElevations-08.pdf | BHX | capex | working_paper | 40 | 3 | 9acdf356b669b6d2 | 2026-04-12T01:27:25.804934+00:00 | `debc43e3-5b88-4ff7-bac6-e18ee50da23d` |

### 069 — financial-versions

Key: `2010ashcxx109internaldoorelevations10|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-109-InternalDoorElevations-10.pdf | BHX | capex | draft | 40 | 3 | a8ef8b4f6b5d3030 | 2026-04-12T10:31:03.968108+00:00 | `50a95f5e-85ca-4303-b951-b5572bd64016` |
| 2 | 2010-A-SH-C-xx-109-InternalDoorElevations-10.pdf | BHX | other | draft | 40 | 3 | 64c7e75878e87b3e | 2026-04-12T01:29:37.557114+00:00 | `b879f1ca-0835-4a2b-9a50-151f61c0e88c` |

### 070 — financial-versions

Key: `2010ashcxx110internaldoorelevations11|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-110-InternalDoorElevations-11.pdf | BHX | other | draft | 40 | 4 | 0e59494bc3a63677 | 2026-04-12T10:32:20.70392+00:00 | `214e07c7-53b1-4cb6-bcf2-7b6b22f75df4` |
| 2 | 2010-A-SH-C-xx-110-InternalDoorElevations-11.pdf | BHX | capex | draft | 40 | 4 | 20637ea47a1e0b7a | 2026-04-12T01:29:17.993613+00:00 | `88adf15d-2748-43d9-b1f6-a0c46f8429c8` |

### 071 — financial-versions

Key: `2010ashcxx200externalgates01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-200-ExternalGates-01.pdf | BHX | capex | draft | 40 | 2 | 55ea2853f48dffd6 | 2026-04-12T10:32:56.020643+00:00 | `2ffbc997-a129-44ec-ac54-9e9cb0f0e6a1` |
| 2 | 2010-A-SH-C-xx-200-ExternalGates-01.pdf | BHX | capex | draft | 40 | 2 | fe12822410bccd58 | 2026-04-12T01:32:16.278978+00:00 | `7d7ca2d1-7d7a-41d4-abd2-435916fbed19` |

### 072 — financial-versions

Key: `2010ashdxx001floorbuildups01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-001-FloorBuildups-01.pdf | BHX | other | draft | 40 | 2 | ecad6da5f2b3b171 | 2026-04-12T10:08:04.229294+00:00 | `08acaaed-57d1-44a2-a955-4996e88abe44` |
| 2 | 2010-A-SH-D-xx-001-FloorBuildups-01.pdf | BHX | capex | draft | 40 | 2 | 94a56603df38c9d1 | 2026-04-12T00:12:19.107308+00:00 | `d47f4951-700d-4fb8-92b0-d4a41d9c8e2e` |
| 3 | 2010-A-SH-D-xx-001-FloorBuildups-01.pdf | BHX | other | draft | 40 | 2 | 8e1182d315c625fd | 2026-04-12T10:08:05.636533+00:00 | `d9943ac8-fee1-4d10-8798-789ef1799708` |

### 073 — financial-versions

Key: `2010ashdxx027ceilingbuildups03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-027-CeilingBuildups-03.pdf | BHX | capex | draft | 40 | 1 | d839c96cf12dab66 | 2026-04-12T00:17:32.220882+00:00 | `02cae652-0262-48f7-824a-ebc73594a045` |
| 2 | 2010-A-SH-D-xx-027-CeilingBuildups-03.pdf | BHX | other | draft | 40 | 1 | 71c2c67424ac44ee | 2026-04-12T10:10:16.410485+00:00 | `99ba5c5b-057b-4440-88a6-4f1c84b579c8` |

### 074 — financial-versions

Key: `2010ashdxx032elevationstudycontroltowerwindow|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-032-ElevationStudy-ControlTowerWindow.pdf | BHX | capex | draft | 40 | 1 | d4ca2147310a0656 | 2026-04-12T00:17:46.111557+00:00 | `1f7e9bf9-77ba-4b6e-b318-b330dae59989` |
| 2 | 2010-A-SH-D-XX-032-ElevationStudy-ControlTowerWindow.pdf | BHX | other | draft | 40 | 1 | f07233e45ad9047a | 2026-04-12T10:06:29.716254+00:00 | `61e7b0e2-8180-4d93-b10b-782cf2352edd` |

### 075 — financial-versions

Key: `2010ashdxx043highlevelventilationdetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-043-HighLevelVentilationDetail-01.pdf | BHX | other | draft | 40 | 1 | edebceed9acec755 | 2026-04-12T10:10:44.518731+00:00 | `30c15052-0402-4351-adc3-3e03433ef850` |
| 2 | 2010-A-SH-D-xx-043-HighLevelVentilationDetail-01.pdf | BHX | capex | draft | 40 | 1 | 1869b2fe3a0af74a | 2026-04-12T00:19:35.489141+00:00 | `8a022c67-5445-4fd3-a034-95ff6e22e994` |

### 076 — financial-versions

Key: `2010ashdxx044highlevelventilationdetail02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-044-HighLevelVentilationDetail-02.pdf | BHX | other | draft | 40 | 1 | d5063109c933abc2 | 2026-04-12T10:11:18.790397+00:00 | `95995fc1-94b7-450f-9a13-4c36c62ae219` |
| 2 | 2010-A-SH-D-xx-044-HighLevelVentilationDetail-02.pdf | BHX | capex | draft | 40 | 1 | c5a64e252a8aec0f | 2026-04-12T00:19:08.825489+00:00 | `b64e21d6-acef-4644-851a-c7f976a589d1` |

### 077 — financial-versions

Key: `2010ashdxx046intermediateleveldetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-046-IntermediateLevelDetail-01.pdf | BHX | capex | draft | 40 | 1 | bfab6cbdb0917733 | 2026-04-12T10:12:05.638763+00:00 | `29b25b45-4164-4652-890e-5eecee40891f` |
| 2 | 2010-A-SH-D-xx-046-IntermediateLevelDetail-01.pdf | BHX | capex | draft | 40 | 1 | 74450a42c725c0e0 | 2026-04-12T00:20:03.151266+00:00 | `8293b9b4-8ef4-4d9c-bb6d-bbd9282c4628` |

### 078 — financial-versions

Key: `2010ashdxx050plandetailplinthlevel|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-050-PlanDetail-PlinthLevel.pdf | BHX | capex | draft | 40 | 1 | 3578b88dba00560f | 2026-04-12T00:20:58.113191+00:00 | `e356d0a8-ab4c-424f-b4df-ac8a3f3b7e97` |
| 2 | 2010-A-SH-D-xx-050-PlanDetail-PlinthLevel.pdf | BHX | other | draft | 40 | 1 | 53583274ef15fcdf | 2026-04-12T10:11:58.982684+00:00 | `f946fc49-6521-4c62-9201-c878806380db` |

### 079 — financial-versions

Key: `2010ashdxx051plandetailcladdinglevel|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-051-PlanDetail-CladdingLevel.pdf | BHX | capex | draft | 40 | 1 | 23b2a9d4436bda21 | 2026-04-12T00:20:17.501213+00:00 | `7ab05329-2a4b-4777-ac54-1d98a06e39cf` |
| 2 | 2010-A-SH-D-xx-051-PlanDetail-CladdingLevel.pdf | BHX | capex | draft | 40 | 3 | d05fdcd15990c91d | 2026-04-12T10:11:34.018476+00:00 | `dabfe918-6f52-4769-b72f-3803b49452a0` |

### 080 — financial-versions

Key: `2010ashdxx052plandetailplantroom|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-052-PlanDetail-Plantroom.pdf | BHX | other | draft | 40 | 1 | 57c5804738c6e34d | 2026-04-12T00:20:30.841755+00:00 | `3ecefa89-6b36-4424-86da-ce26ec037356` |
| 2 | 2010-A-SH-D-xx-052-PlanDetail-Plantroom.pdf | BHX | capex | draft | 40 | 1 | 78d742690c5ceb50 | 2026-04-12T10:11:50.640027+00:00 | `48c2c494-f3b6-48c3-b7fe-94b6297810f9` |

### 081 — financial-versions

Key: `2010ashdxx054plandetaillargeradiuscornersouth|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-054-PlanDetail-LargeRadiusCorner-South.pdf | BHX | other | draft | 40 | 1 | db9bfa1981225b95 | 2026-04-12T00:22:07.054041+00:00 | `348a29c4-7451-4b68-8689-78a16b1ae62f` |
| 2 | 2010-A-SH-D-xx-054-PlanDetail-LargeRadiusCorner-South.pdf | BHX | capex | draft | 40 | 1 | 9a540ec60ecb8f14 | 2026-04-12T10:13:42.425031+00:00 | `3d9f1f85-0061-4a77-b0f4-f057d62a961d` |
| 3 | 2010-A-SH-D-xx-054-PlanDetail-LargeRadiusCorner-South.pdf | BHX | other | draft | 40 | 1 | f147a3bf2590b8fe | 2026-04-12T10:13:49.153721+00:00 | `d2d30a7d-89c5-4d23-9052-a7e564efa881` |

### 082 — financial-versions

Key: `2010ashdxx065typicalvergedetail02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-065-TypicalVergeDetail-02.pdf | BHX | capex | draft | 40 | 1 | 44bde0355ab4114b | 2026-04-12T00:22:48.174469+00:00 | `4ed88d44-dd4a-40fc-adb6-2329733b1e6b` |
| 2 | 2010-A-SH-D-xx-065-TypicalVergeDetail-02.pdf | BHX | capex | draft | 40 | 1 | 6ad898846c9d85d2 | 2026-04-12T10:15:03.208812+00:00 | `7634f3b7-b949-4dff-bfa4-f58ad57443d0` |

### 083 — financial-versions

Key: `2010ashdxx069secondaryspandetails|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-069-SecondarySpanDetails.pdf | BHX | capex | draft | 40 | 1 | d3cc6b37fc0d056e | 2026-04-12T10:14:25.751639+00:00 | `1f80e8b4-02ee-4ade-ae69-a5cb1cd6a33e` |
| 2 | 2010-A-SH-D-xx-069-SecondarySpanDetails.pdf | BHX | other | draft | 40 | 1 | ce8458485f0a7d76 | 2026-04-12T00:23:56.962068+00:00 | `6cc39d4a-4400-4166-9d32-c1cb9550de14` |

### 084 — financial-versions

Key: `2010ashdxx070canopydetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-070-CanopyDetails-01.pdf | BHX | capex | draft | 40 | 4 | b1c6c0d2f5578aa7 | 2026-04-12T00:24:48.024124+00:00 | `63a8aa33-57cd-43fa-9f1c-5072f4334813` |
| 2 | 2010-A-SH-D-xx-070-CanopyDetails-01.pdf | BHX | other | draft | 40 | 3 | 9c37759829088e59 | 2026-04-12T10:14:46.13085+00:00 | `9fb1c4a7-cc18-418b-8b94-28128b7422b0` |

### 085 — financial-versions

Key: `2010ashdxx075entranceroof02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-075-EntranceRoof-02.pdf | BHX | other | draft | 40 | 2 | eec7097bb865d709 | 2026-04-12T10:15:29.35419+00:00 | `abcc563d-1ffc-44bf-bf27-51f2112d6225` |
| 2 | 2010-A-SH-D-xx-075-EntranceRoof-02.pdf | BHX | capex | draft | 40 | 1 | 0ef08e055c01bd2b | 2026-04-12T00:25:16.880727+00:00 | `fa71ae44-8284-4a67-a41a-324cb9e97c6c` |

### 086 — financial-versions

Key: `2010ashdxx076entranceroof03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-076-EntranceRoof-03.pdf | BHX | capex | draft | 40 | 1 | 9fe42a6a2a61b265 | 2026-04-12T10:15:49.702781+00:00 | `1a7c075b-6d21-4ae7-9ce1-425ac21921e1` |
| 2 | 2010-A-SH-D-xx-076-EntranceRoof-03.pdf | BHX | capex | draft | 40 | 1 | eb51cd16f6e156dd | 2026-04-12T00:26:03.188022+00:00 | `a5237297-cda0-4bc2-8f53-7ff1d3c6ab05` |

### 087 — financial-versions

Key: `2010ashdxx083curtainwallingglazingdetails04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-083-CurtainWalling-GlazingDetails-04.pdf | BHX | capex | draft | 40 | 1 | b9fc6b2165840f96 | 2026-04-12T00:26:31.319963+00:00 | `b388c1df-8fd0-410f-919e-16c49e64c2bd` |
| 2 | 2010-A-SH-D-xx-083-CurtainWalling-GlazingDetails-04.pdf | BHX | other | draft | 40 | 1 | ac88b32867188799 | 2026-04-12T10:17:29.927762+00:00 | `e97e47f3-56ea-42eb-8220-d6a2b58e1dd2` |

### 088 — financial-versions

Key: `2010ashdxx089entrancedoorglazingdetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-089-EntranceDoor&GlazingDetails-01.pdf | BHX | other | draft | 40 | 2 | 5c5741f37928f0ff | 2026-04-12T10:16:57.037114+00:00 | `47f47f9c-842d-40d5-a40d-a0237c04bb9c` |
| 2 | 2010-A-SH-D-xx-089-EntranceDoor&GlazingDetails-01.pdf | BHX | other | draft | 40 | 3 | 286a1ec99edffc69 | 2026-04-12T10:17:00.012808+00:00 | `99419570-7fa4-4100-8da7-e6d879491fa0` |
| 3 | 2010-A-SH-D-xx-089-EntranceDoor&GlazingDetails-01.pdf | BHX | capex | draft | 40 | 1 | 863232e639c8c081 | 2026-04-12T00:27:31.737757+00:00 | `c55fb41e-ad24-4075-a317-14f0f82fd6c6` |

### 089 — financial-versions

Key: `2010ashdxx090entrancedoorglazingdetails02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-090-EntranceDoor&GlazingDetails-02.pdf | BHX | other | draft | 40 | 1 | d39eb9dedfa88c10 | 2026-04-12T10:17:14.221416+00:00 | `600c3d67-ff78-400d-8e21-37bf1c8267c2` |
| 2 | 2010-A-SH-D-xx-090-EntranceDoor&GlazingDetails-02.pdf | BHX | capex | draft | 40 | 2 | 04c63ce1ce9f4d81 | 2026-04-12T00:27:45.219133+00:00 | `c09fc19b-4124-4d82-aad8-9eb33a8335c1` |

### 090 — financial-versions

Key: `2010ashdxx095typicalsoliddoor|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-XX-095-TypicalSolidDoor.pdf | BHX | capex | draft | 40 | 3 | 681fa440b3a6af13 | 2026-04-12T10:07:03.182542+00:00 | `9cdb3754-6f78-4b31-ae65-b24d190da8da` |
| 2 | 2010-A-SH-D-xx-095-TypicalSolidDoor.pdf | BHX | general | draft | 40 | 1 | 76b9d16724fdae44 | 2026-04-12T00:28:56.02592+00:00 | `ced4b443-9a1d-431f-a629-aac7638e1224` |

### 091 — financial-versions

Key: `2010ashdxx096typicalplantdoor|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-096-TypicalPlantDoor.pdf | BHX | capex | draft | 40 | 1 | 779de7c3f03b8da6 | 2026-04-12T00:29:20.069981+00:00 | `70207260-bcde-4d9f-b5fb-dee7eebd81c3` |
| 2 | 2010-A-SH-D-XX-096-TypicalPlantDoor.pdf | BHX | capex | draft | 40 | 2 | 4c04c90d8e76099e | 2026-04-12T10:07:20.647753+00:00 | `dec7f925-b8fc-4612-9163-d28da5648b24` |

### 092 — financial-versions

Key: `2010ashdxx101typicalbulkheadsections|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-101-TypicalBulkheadSections.pdf | BHX | other | draft | 40 | 1 | c7bc0a65ccaa16fb | 2026-04-12T10:18:05.335005+00:00 | `8d5b2391-8a17-4da7-8cc7-94ac88b6550b` |
| 2 | 2010-A-SH-D-xx-101-TypicalBulkheadSections.pdf | BHX | capex | draft | 40 | 1 | 45c21fc7b615362d | 2026-04-12T00:30:53.410528+00:00 | `f165cf32-4c6b-44a7-91ce-ef2ab1d2312d` |

### 093 — financial-versions

Key: `2010ashdxx105partitionsections01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-105-PartitionSections-01.pdf | BHX | capex | unknown | 40 | 4 | 009f4d982b783498 | 2026-04-12T00:30:20.635407+00:00 | `17edc916-887a-42d9-b21f-a1c46a85267b` |
| 2 | 2010-A-SH-D-xx-105-PartitionSections-01.pdf | BHX | other | unknown | 40 | 4 | ed56ae42dcf97f74 | 2026-04-12T10:18:21.002209+00:00 | `7810aa02-0a3d-46a1-bbd1-975f5fc2baba` |

### 094 — financial-versions

Key: `2010ashdxx116partitionplans02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-116-PartitionPlans-02.pdf | BHX | other | draft | 40 | 1 | 603c0ea912979e42 | 2026-04-12T00:31:53.292473+00:00 | `8bb8589e-fbf6-4084-ad1a-e65702f953a9` |
| 2 | 2010-A-SH-D-xx-116-PartitionPlans-02.pdf | BHX | capex | draft | 40 | 1 | c9db45cb503a862f | 2026-04-12T10:19:34.000422+00:00 | `e1ed98d1-d8dc-4b86-b2dc-18a287038b8a` |

### 095 — financial-versions

Key: `2010ashdxx118partitionplans04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-118-PartitionPlans-04.pdf | BHX | capex | draft | 40 | 1 | 9ff0f76f05debd22 | 2026-04-12T10:21:08.90864+00:00 | `3178d7a4-8efc-4cd9-8976-9eb69be66a49` |
| 2 | 2010-A-SH-D-xx-118-PartitionPlans-04.pdf | BHX | capex | draft | 40 | 1 | 379afd461dcde527 | 2026-04-12T00:33:27.361973+00:00 | `894cbaa5-0f59-4d98-aeab-dc90cbd3c315` |

### 096 — financial-versions

Key: `2010ashdxx125deflectionheadbulkhead|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-125-DeflectionHead-Bulkhead.pdf | BHX | capex | draft | 40 | 1 | 5b40e9c2b47b4a17 | 2026-04-12T10:20:22.538847+00:00 | `31d51601-013d-4cc2-a481-20dd92c0e606` |
| 2 | 2010-A-SH-D-xx-125-DeflectionHead-Bulkhead.pdf | BHX | capex | draft | 40 | 1 | 2e553b4776f5e187 | 2026-04-12T00:33:41.006551+00:00 | `dcade10c-3e40-4722-8c54-7d3d12f54f8c` |

### 097 — financial-versions

Key: `2010ashdxx127deflectionheadnonstandard|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-127-DeflectionHead-NonStandard.pdf | BHX | asset_management | draft | 40 | 1 | 1644de35159184bc | 2026-04-12T10:20:37.183916+00:00 | `5eb13998-8f6c-4306-a96d-2bef2c832a3b` |
| 2 | 2010-A-SH-D-xx-127-DeflectionHead-NonStandard.pdf | BHX | capex | draft | 40 | 1 | 808a0ea67ad4cfa0 | 2026-04-12T00:34:35.686252+00:00 | `fc92d711-b803-4e4c-9b9c-37de27a80964` |

### 098 — financial-versions

Key: `2010ashdxx203binenclosuredetails|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-203-BinEnclosureDetails.pdf | BHX | other | draft | 40 | 2 | 161252873470e9c2 | 2026-04-12T00:49:10.085885+00:00 | `b3bb5bc4-4f3e-4001-aa62-ccc30522ab98` |
| 2 | 2010-A-SH-D-xx-203-BinEnclosureDetails.pdf | BHX | capex | working_paper | 40 | 1 | 886b01e1f531313e | 2026-04-12T10:24:06.668275+00:00 | `c191045e-98d4-49eb-8a63-dcf366fcd208` |

### 099 — financial-versions

Key: `2010ashexx220plant01elevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-220-Plant01Elevations.pdf | BHX | capex | draft | 40 | 1 | 7c06ef797f72d04e | 2026-04-12T01:49:16.783529+00:00 | `0e887159-764e-4375-a6fd-2154916b535b` |
| 2 | 2010-A-SH-E-xx-220-Plant01-Elevations.pdf | BHX | other | draft | 40 | 1 | 3729d602d11330e7 | 2026-04-12T08:52:14.620393+00:00 | `73aa96cd-314f-43ff-8e47-ff558f97e4e2` |

### 100 — financial-versions

Key: `2010ashexx221plant02elevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-221-Plant02Elevations.pdf | BHX | capex | draft | 40 | 2 | b9ac568bc0eb92fa | 2026-04-12T01:49:30.215192+00:00 | `2e2ab9fc-c1c4-4bd3-88be-70e81b6af0c9` |
| 2 | 2010-A-SH-E-xx-221-Plant02-Elevations.pdf | BHX | other | draft | 40 | 3 | f4a6135618d66a63 | 2026-04-12T08:52:54.822292+00:00 | `36331b9f-d84a-4af8-9eda-7479bfc75703` |
| 3 | 2010-A-SH-E-xx-221-Plant02-Elevations.pdf | BHX | other | draft | 40 | 2 | 3ed8cc6bab57742d | 2026-04-12T08:52:47.384641+00:00 | `f67177ae-1608-417e-943b-5e0a82b3f116` |

### 101 — financial-versions

Key: `2010ashexx223binenclosureelevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-223-BinEnclosureElevations.pdf | BHX | capex | draft | 40 | 2 | 85b23b3161b88141 | 2026-04-12T02:12:11.681402+00:00 | `1291f46b-56e5-485f-9cc6-eff7c2f5ee08` |
| 2 | 2010-A-SH-E-xx-223-BinEnclosureElevations.pdf | BHX | other | draft | 40 | 1 | a78f107e6560da68 | 2026-04-12T08:52:28.666516+00:00 | `7a0cf7a7-fab2-4c73-a9d5-f7ddd5544e54` |

### 102 — financial-versions

Key: `2010ashp00110groundfloorplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-110-GroundFloorPlan.pdf | BHX | other | draft | 40 | 1 | 30887b592c424c93 | 2026-04-12T08:53:14.873328+00:00 | `80f7adee-9577-49e8-806a-9d3345835c0a` |
| 2 | 2010-A-SH-P-00-110-GroundFloorPlan.pdf | BHX | capex | draft | 40 | 2 | 76a0d71955cd96ee | 2026-04-12T02:11:51.552192+00:00 | `df7b6940-58e4-4467-ab61-8502cff85fb3` |

### 103 — financial-versions

Key: `2010ashp00113groundfloorplan22|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-113-GroundFloorPlan-2_2.pdf | BHX | other | draft | 40 | 2 | f7970d3386d2d957 | 2026-04-12T02:01:56.412339+00:00 | `040ff9ed-c549-4e4f-8f19-dd0fbcb6faf5` |
| 2 | 2010-A-SH-P-00-113-GroundFloorPlan-2_2.pdf | BHX | capex | draft | 40 | 2 | b33d76e6bd61229d | 2026-04-12T09:07:49.105137+00:00 | `145f3eaf-9d5d-499f-ac32-ebc62fc8e8bf` |
| 3 | 2010-A-SH-P-00-113-GroundFloorPlan-2_2.pdf | BHX | capex | draft | 40 | 2 | 125e82a7889bb858 | 2026-04-12T09:09:01.139666+00:00 | `35b1795f-ad78-4fa5-b10e-e5e34ead4ef2` |

### 104 — financial-versions

Key: `2010ashp00131detailgroundfloorplan25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-131-DetailGroundFloorPlan-2_5.pdf | BHX | other | draft | 40 | 1 | 7ea55d79f5a0fc82 | 2026-04-12T08:53:29.474747+00:00 | `9f83812d-267b-43b8-b6f5-372d770994cb` |
| 2 | 2010-A-SH-P-00-131-DetailGroundFloorPlan-2_5.pdf | BHX | capex | draft | 40 | 2 | 3e6bf4c6102b8ae6 | 2026-04-12T02:40:47.237956+00:00 | `fbf497f8-b2df-489d-ade4-353e255a6d08` |

### 105 — financial-versions

Key: `2010ashp00132detailgroundfloorplan35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-132-DetailGroundFloorPlan-3_5.pdf | BHX | other | draft | 40 | 1 | dbaed26b491e48e2 | 2026-04-12T08:53:29.620259+00:00 | `2fbb0f6c-9c77-4b86-9775-23a11f5f0149` |
| 2 | 2010-A-SH-P-00-132-DetailGroundFloorPlan-3_5.pdf | BHX | capex | draft | 40 | 1 | 116f019146b14973 | 2026-04-12T02:30:46.303708+00:00 | `4b6ae203-4cb8-483e-81ce-1cc016ab25de` |

### 106 — financial-versions

Key: `2010ashp00133detailgroundfloorplan45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-133-DetailGroundFloorPlan-4_5.pdf | BHX | other | draft | 40 | 1 | c110fa41aac6ddf9 | 2026-04-12T08:53:43.296117+00:00 | `1f775b97-af2c-45aa-8133-fed5f7468c28` |
| 2 | 2010-A-SH-P-00-133-DetailGroundFloorPlan-4_5.pdf | BHX | capex | draft | 40 | 1 | dca80a9e33aa0941 | 2026-04-12T02:22:21.658983+00:00 | `6df8ea93-ad6b-4d72-9875-e3e45161ffe8` |

### 107 — financial-versions

Key: `2010ashp00134detailgroundfloorplan55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-134-DetailGroundFloorPlan-5_5.pdf | BHX | other | draft | 40 | 7 | 93d17957a17d6c0f | 2026-04-12T09:20:25.731783+00:00 | `563af5e3-2e0e-478e-85eb-e81b116f1781` |
| 2 | 2010-A-SH-P-00-134-DetailGroundFloorPlan-5_5.pdf | BHX | other | draft | 40 | 7 | 4d392bcd17a6a1cd | 2026-04-12T09:20:28.049405+00:00 | `ad53b89d-c757-419d-a246-c7eafc5f9cda` |
| 3 | 2010-A-SH-P-00-134-DetailGroundFloorPlan-5_5.pdf | BHX | capex | draft | 40 | 10 | 8d5ccb5534a4ead3 | 2026-04-12T02:30:31.038051+00:00 | `c6d56afb-2f8a-4634-8ec0-ade4bbadc2c9` |

### 108 — financial-versions

Key: `2010ashp00151gfbuildups25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-151-GFBuildups-2_5.pdf | BHX | capex | draft | 40 | 1 | dab239f21b3d9df9 | 2026-04-12T02:42:24.844094+00:00 | `240f1e87-9427-4cfb-b86d-736bcd70f8b0` |
| 2 | 2010-A-SH-P-00-151-GFBuildups-2_5.pdf | BHX | capex | draft | 40 | 2 | 6a52c451f6d7c4b6 | 2026-04-12T09:08:38.735965+00:00 | `f7c6ca5d-de3f-4c23-af67-45c9e299126d` |

### 109 — financial-versions

Key: `2010ashp00153gfbuildups45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-153-GFBuildups--4_5.pdf | BHX | capex | working_paper | 40 | 1 | e8ba9869b89d326e | 2026-04-12T02:41:27.470704+00:00 | `b921a9dc-6e87-43d3-a39f-9878e0a98dda` |
| 2 | 2010-A-SH-P-00-153-GFBuildups--4_5.pdf | BHX | capex | draft | 40 | 1 | ea7f6cbac16b53bb | 2026-04-12T09:20:48.011739+00:00 | `d115cd0b-b8f6-47c3-a9be-fc9db362b6ce` |

### 110 — financial-versions

Key: `2010ashp00154gfbuildups55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-154-GFBuildups-5_5.pdf | BHX | capex | draft | 40 | 2 | 94e75f6802471c81 | 2026-04-12T02:41:46.54621+00:00 | `4d704c98-0fdf-4179-b8c7-87c326ba17c5` |
| 2 | 2010-A-SH-P-00-154-GFBuildups-5_5.pdf | BHX | capex | draft | 40 | 2 | d3e19db493a9df86 | 2026-04-12T09:21:31.378768+00:00 | `537b4dc1-ca93-4f6f-9d4d-2a895ad4f3ee` |

### 111 — financial-versions

Key: `2010ashp00170reflectedceilingplan15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-170-ReflectedCeilingPlan-1_5.pdf | BHX | capex | draft | 40 | 3 | 8888bed16c733bc2 | 2026-04-12T02:42:43.969946+00:00 | `3342a500-0e26-4dec-9c80-9e34df748131` |
| 2 | 2010-A-SH-P-00-170-ReflectedCeilingPlan-1_5.pdf | BHX | other | draft | 40 | 2 | 87e9f081a2d0239d | 2026-04-12T09:20:48.026302+00:00 | `55d5149a-c33d-4e70-983c-6542bd2e9279` |

### 112 — financial-versions

Key: `2010ashp00172reflectedceilingplan35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-172-ReflectedCeilingPlan-3_5.pdf | BHX | capex | draft | 40 | 2 | 078a0a032eb8127d | 2026-04-12T09:21:58.499216+00:00 | `32c69afb-dc55-4a03-87ec-a1516dd8c416` |
| 2 | 2010-A-SH-P-00-172-ReflectedCeilingPlan-3_5.pdf | BHX | other | draft | 40 | 2 | 7e7ff3ce58a3e2e1 | 2026-04-12T02:43:47.938832+00:00 | `a1683d4f-f541-48b3-bde9-60bda72e80ba` |
| 3 | 2010-A-SH-P-00-172-ReflectedCeilingPlan-3_5.pdf | BHX | other | draft | 40 | 2 | defb3f372a05d3c4 | 2026-04-12T09:21:51.011539+00:00 | `a77ffd8c-5684-43c8-b38b-2f429f50f0a7` |

### 113 — financial-versions

Key: `2010ashp00181gffinishes25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-181-GFFinishes-2_5.pdf | BHX | asset_management | draft | 40 | 2 | 4f2ee346caa9b3bd | 2026-04-12T09:23:14.008268+00:00 | `45aa5b51-580f-4142-9d32-7a72da64c360` |
| 2 | 2010-A-SH-P-00-181-GFFinishes-2_5.pdf | BHX | capex | draft | 40 | 2 | 1cef28fa2bb26c89 | 2026-04-12T02:45:33.749407+00:00 | `6d4bf699-3800-4b49-a553-221c93b74bb3` |

### 114 — financial-versions

Key: `2010ashp00182gffinished35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-182-GFFinished-3_5.pdf | BHX | other | draft | 40 | 1 | ca81ee3024288684 | 2026-04-12T09:22:59.764322+00:00 | `1492b5d5-8df3-4a64-818f-edd970a0e6e6` |
| 2 | 2010-A-SH-P-00-182-GFFinished-3_5.pdf | BHX | other | draft | 40 | 1 | 8f1e998399cdf9f2 | 2026-04-12T09:22:55.491688+00:00 | `8f4c7709-5491-43ed-8a0e-e593e45cd1dc` |
| 3 | 2010-A-SH-P-00-182-GFFinished-3_5.pdf | BHX | capex | draft | 40 | 2 | 9d76520983a6f319 | 2026-04-12T02:45:14.777706+00:00 | `b9712fe6-304a-40b7-9e43-056d7a225f04` |

### 115 — financial-versions

Key: `2010ashp00184gffinishes55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-184-GFFinishes-5_5.pdf | BHX | capex | draft | 40 | 1 | 58be5cb76ec654b7 | 2026-04-12T09:22:36.793139+00:00 | `59b48290-a102-41cb-aefb-a0ac79b8c795` |
| 2 | 2010-A-SH-P-00-184-GFFinishes-5_5.pdf | BHX | other | draft | 40 | 2 | 19f9a317734a8a65 | 2026-04-12T02:45:00.4905+00:00 | `ab03e938-4f6e-4c28-80d0-829993d9c876` |
| 3 | 2010-A-SH-P-00-184-GFFinishes-5_5.pdf | BHX | other | draft | 40 | 2 | 99c309d379438f97 | 2026-04-12T09:22:32.594984+00:00 | `f73abd1c-cad3-4659-a452-3ec3923c664c` |

### 116 — financial-versions

Key: `2010ashp00423gfdrainage45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-423-GF-Drainage-4_5.pdf | BHX | other | draft | 40 | 1 | fdc0e4302d9e034c | 2026-04-12T09:24:08.463096+00:00 | `41265e29-3712-4da1-bd20-7359c3e5d2e0` |
| 2 | 2010-A-SH-P-00-423-GF-Drainage-4_5.pdf | BHX | other | draft | 40 | 1 | 0e283e11bbfdf708 | 2026-04-12T09:24:14.128191+00:00 | `acae983d-f771-496a-89a4-ddc1d0b67b10` |
| 3 | 2010-A-SH-P-00-423-GF-Drainage-4_5.pdf | BHX | capex | draft | 40 | 2 | a06e2630c9cb6478 | 2026-04-12T02:56:52.107398+00:00 | `f24403df-97ab-4d46-8427-50c6a71f155c` |

### 117 — financial-versions

Key: `2010ashp00424gfdrainage55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-424-GF-Drainage-5_5.pdf | BHX | capex | draft | 40 | 2 | 5c914ad459f1c051 | 2026-04-12T02:57:55.859345+00:00 | `20f551d7-8243-44af-b974-973ebfe5420d` |
| 2 | 2010-A-SH-P-00-424-GF-Drainage-5_5.pdf | BHX | other | draft | 40 | 2 | 5b164351818e0311 | 2026-04-12T09:23:42.186055+00:00 | `9b332054-55cd-44c6-b0d5-800ded5f3d40` |

### 118 — financial-versions

Key: `2010ashp01160ffbuildups15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-160-FFBuildups-1_5.pdf | BHX | capex | draft | 40 | 1 | 630bb428b1abc73f | 2026-04-12T02:58:59.396879+00:00 | `1d0828ca-ebe8-4f33-8268-29c183c3eba5` |
| 2 | 2010-A-SH-P-01-160-FFBuildups-1_5.pdf | BHX | other | draft | 40 | 1 | 625079d596672502 | 2026-04-12T09:24:00.219919+00:00 | `b981d344-a99d-42d4-b1ba-b17a082f5ccd` |

### 119 — financial-versions

Key: `2010ashp01162ffbuildups35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-162-FFBuildups-3_5.pdf | BHX | other | draft | 40 | 1 | 4f82cb14d6ae5494 | 2026-04-12T09:25:40.241608+00:00 | `161d2caf-6c8c-4ecb-ba6d-20e6ff1fd6b5` |
| 2 | 2010-A-SH-P-01-162-FFBuildups-3_5.pdf | BHX | capex | working_paper | 40 | 1 | cc0c4ceeb4257a94 | 2026-04-12T02:58:37.825958+00:00 | `497890b0-d62e-4bc8-b4a8-b1231ba4f093` |

### 120 — financial-versions

Key: `2010ashp01163ffbuildups45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-163-FFBuildups-4_5.pdf | BHX | other | draft | 40 | 1 | 3a9fe8ebb213db5c | 2026-04-12T09:25:26.53147+00:00 | `2621bbe2-c895-4a0e-b6b6-2a7bd0500fc3` |
| 2 | 2010-A-SH-P-01-163-FFBuildups-4_5.pdf | BHX | capex | draft | 40 | 1 | c361cc9e1fca721a | 2026-04-12T03:09:11.297972+00:00 | `9ce8f691-546a-4506-9de5-79d42675a8d8` |

### 121 — financial-versions

Key: `2010ashp01164ffbuildups55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-164-FFBuildups-5_5.pdf | BHX | other | draft | 40 | 1 | a88cc74bc54f075a | 2026-04-12T09:24:49.261239+00:00 | `340a8685-7b24-404b-968c-b0faef143377` |
| 2 | 2010-A-SH-P-01-164-FFBuildups-5_5.pdf | BHX | capex | draft | 40 | 1 | 4094580cbc7488e4 | 2026-04-12T03:19:48.895992+00:00 | `60d9d539-d467-45be-b6b1-5cc6f2c3dd74` |

### 122 — financial-versions

Key: `2010ashprf140detailroofplan15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-RF-140-DetailRoofPlan-1_5.pdf | BHX | other | draft | 40 | 1 | f3cfc5078939c6a5 | 2026-04-12T09:25:54.520385+00:00 | `17cb96e0-d066-43ae-90a0-557ef1588487` |
| 2 | 2010-A-SH-P-RF-140-DetailRoofPlan-1_5.pdf | BHX | capex | draft | 40 | 1 | 82e8c27aa76caab5 | 2026-04-12T03:21:29.916259+00:00 | `d6c0e1e5-da9f-478f-9264-3b734d7771e9` |

### 123 — financial-versions

Key: `2010ashprf141detailroofplan25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-RF-141-DetailRoofPlan-2_5.pdf | BHX | other | draft | 40 | 1 | f8d471c3232f95d1 | 2026-04-12T03:20:44.270846+00:00 | `5829f335-7b15-47af-8e44-720e09ddfbc8` |
| 2 | 2010-A-SH-P-RF-141-DetailRoofPlan-2_5.pdf | BHX | capex | draft | 40 | 114 | 7f5474319e66ee45 | 2026-04-12T09:37:50.863587+00:00 | `707f0cbd-ad47-468c-8b0e-14878ee266da` |
| 3 | 2010-A-SH-P-RF-141-DetailRoofPlan-2_5.pdf | BHX | capex | draft | 40 | 12 | 121ee82c8d3ef098 | 2026-04-12T09:38:03.701763+00:00 | `95473b0a-2b20-4a4a-a3c0-2cff8a239daf` |

### 124 — financial-versions

Key: `2010ashprf143detailroofplan45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-RF-143-DetailRoofPlan-4_5.pdf | BHX | capex | draft | 40 | 1 | be55b2573c535281 | 2026-04-12T09:26:02.701025+00:00 | `1b5ebc53-c0c2-4537-beb0-25238e91fa2c` |
| 2 | 2010-A-SH-P-RF-143-DetailRoofPlan-4_5.pdf | BHX | asset_management | draft | 40 | 1 | 6f5de097d8141763 | 2026-04-12T03:20:30.930332+00:00 | `4f3b434e-60fc-4d41-9a47-078e2c281f31` |

### 125 — financial-versions

Key: `2010ashsxx300hubsections01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-S-xx-300-HubSections-01.pdf | BHX | other | unknown | 0 | 1 | 61fb1107302cc524 | 2026-04-12T09:27:16.739452+00:00 | `652d0369-8cfd-4588-94f3-b4c354ed4ae4` |
| 2 | 2010-A-SH-S-xx-300-HubSections-01.pdf | BHX | capex | draft | 40 | 2 | e58487e994a523f1 | 2026-04-12T03:23:24.08435+00:00 | `a3edbcfd-d39b-4108-9a9d-e0d21d0c442f` |

### 126 — financial-versions

Key: `2010asitepxx101masterplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-Site-P-xx-101-Masterplan.pdf | BHX | capex | draft | 40 | 3 | 8b69821f19f41883 | 2026-04-12T09:38:42.66376+00:00 | `279d2514-f69c-4623-bce5-55aa5363ba9d` |
| 2 | 2010-A-Site-P-xx-101-Masterplan.pdf | BHX | capex | draft | 40 | 3 | caa6b7e0db7bca7f | 2026-04-12T01:47:21.314591+00:00 | `4953f16a-1dae-4594-8369-eb3a1b8fb0a1` |

### 127 — financial-versions

Key: `2010asitepxx107serviceyardcdm|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-Site-P-xx-107-ServiceYard-CDM.pdf | BHX | legal | draft | 40 | 2 | b352d55a2e9e49ca | 2026-04-12T01:46:48.145179+00:00 | `4c378557-6307-491d-8852-bb005b7a32a6` |
| 2 | 2010-A-Site-P-xx-107-ServiceYard-CDM.pdf | BHX | capex | draft | 40 | 2 | b1b48d9fc0df365d | 2026-04-12T10:38:10.79333+00:00 | `9319bcda-b477-4bce-9677-ff00040d9d92` |

### 128 — financial-versions

Key: `2010asyp00100serviceyardplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SY-P-00-100-ServiceYardPlan.pdf | BHX | general | executed | 40 | 1 | f78e755deaef0c97 | 2026-04-12T04:10:49.629154+00:00 | `a3631bfa-d141-4be8-b389-c54a146915ac` |
| 2 | 2010-A-SY-P-00-100-ServiceYardPlan.pdf | BHX | capex | executed | 40 | 1 | 2b955d32d3008db6 | 2026-04-12T04:18:19.70354+00:00 | `b8b8ad1b-7fd2-47ce-b75c-8c0bf5d7e6ee` |

### 129 — financial-versions

Key: `2010asyp00101maintenancebuildingplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SY-P-00-101-MaintenanceBuildingPlan.pdf | BHX | other | executed | 40 | 1 | 8f4fff175fef9c61 | 2026-04-12T04:10:22.014918+00:00 | `d793648a-2c25-444b-93fc-9a46124b8c0a` |
| 2 | 2010-A-SY-P-00-101-MaintenanceBuildingPlan.pdf | BHX | capex | executed | 40 | 1 | bf8442667291a29f | 2026-04-12T04:17:41.149967+00:00 | `dfa3d9bf-13e0-4ce3-bfe7-5f1d4b50dc01` |

### 130 — financial-versions

Key: `20250409gemswellisroadmapandbudget|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2025-04-09 Gemswell IS Roadmap and Budget.pdf | GVF | bp_model | working_paper | 85 | 10 | 5e3f8db9091731ae | 2026-04-12T12:10:05.389807+00:00 | `5e6f32bf-81a3-40a3-8c85-f664ca43355f` |
| 2 | 2025-04-09 Gemswell IS Roadmap and Budget.pdf | GVF | bp_model | working_paper | 85 | 23 | 1562543c3c73962e | 2026-04-12T12:09:46.059409+00:00 | `7ea1f1b7-aaee-480d-854f-4930cdf0cc97` |

### 131 — financial-versions

Key: `20gemswellsurfparksopcovtbdexe|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2025.06.19_Gemswell Surf Parks OpCo_VTBD_EXE.pdf | GVF | bp_model | unknown | 85 | 13 | 220000dacf296cbb | 2026-04-12T12:11:28.788875+00:00 | `4cfec10e-c732-43a0-80d5-b0604e81ed4b` |
| 2 | 2025.06.19_Gemswell Surf Parks OpCo_VTBD_EXE.pdf | GVF | bp_model | unknown | 85 | 18 | ec32aea7531f8878 | 2026-04-12T12:10:39.80053+00:00 | `61a72d16-5eae-41c0-bd8d-2003edfa9ea2` |
| 3 | 2025.07.15_Gemswell Surf Parks OpCo_VTBD_EXE.pdf | GVF | bp_model | unknown | 85 | 18 | 7dba72a456da4c0c | 2026-04-12T12:10:47.722957+00:00 | `939ab5fa-7476-4c9e-9fb2-9e296b301c22` |
| 4 | 2025.06.09_Gemswell Surf Parks OpCo_VTBD_EXE.pdf | GVF | bp_model | unknown | 85 | 12 | 0591ed9b3f832df0 | 2026-04-12T12:10:23.372126+00:00 | `b79f4e44-d714-4ad8-b7b2-12423efd74e5` |
| 5 | 2025.06.09_Gemswell Surf Parks OpCo_VTBD_EXE.pdf | GVF | bp_model | unknown | 85 | 17 | f1d6f63977d207ff | 2026-04-12T12:11:23.690996+00:00 | `e4718489-728d-4039-a71d-31ef92d1903b` |

### 132 — financial-versions

Key: `20surfparkestepona|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2024.02.07_SurfPark Estepona.pdf | GVF | dd | working_paper | 60 | 72 | 3de4758593bbac67 | 2026-04-12T12:36:52.582281+00:00 | `7901dc8e-51b1-45a1-9083-3a9207e061ee` |
| 2 | 2024.02.07_SurfPark Estepona.pdf | GVF | dd | working_paper | 60 | 60 | 3d57e74959a69c6a | 2026-04-12T12:34:59.911168+00:00 | `8024caf4-d455-42cd-ad13-8cd914dbda0a` |

### 133 — financial-versions

Key: `20surfparkmadridatm|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2023.05.17_SurfPark Madrid ATM.pdf | GVF | bp_model | unknown | 85 | 54 | a5a8f3065c3ece25 | 2026-04-12T12:08:10.954306+00:00 | `43a5c321-15d3-41b7-996a-a7a90e7f05b8` |
| 2 | 2023.05.17_SurfPark Madrid ATM.pdf | GVF | bp_model | unknown | 85 | 64 | b269d29cd768e5a9 | 2026-04-12T12:08:57.373386+00:00 | `7908f8c9-0e80-45d5-b1a5-cfcebb5d6a03` |

### 134 — financial-versions

Key: `20swteaserwaveparksfinancials|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2025.10.06_SW Teaser Wave Parks (financials).pdf | PHILAE | funding | unknown | 10 | 24 | 8df49e419980ac34 | 2026-04-12T12:46:49.548105+00:00 | `46b41d99-88b5-495b-b0a2-cc9161828b3f` |
| 2 | 2025.10.06_SW Teaser Wave Parks (financials).pdf | PHILAE | funding | unknown | 10 | 5 | 0f79f19c0aece80c | 2026-04-12T12:46:00.701284+00:00 | `87b29b3c-c470-4d7d-bcc0-59962a51408f` |

### 135 — financial-versions

Key: `20swwaveparks|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2024.03.19_SW Wave Parks.pdf | PHILAE | dd | working_paper | 40 | 90 | 4b1b07aedbe65089 | 2026-04-12T12:14:08.627931+00:00 | `4bf78a11-1e6b-4b84-97e4-1cc2bb1d7c47` |
| 2 | 2024.03.19_SW Wave Parks.pdf | PHILAE | funding | unknown | 10 | 105 | f51858ed94b2c6c1 | 2026-04-12T12:12:52.675885+00:00 | `da5643b4-e062-438f-b7bd-4499e655a678` |

### 136 — financial-versions

Key: `20swwaveparksespanol|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2025.09.19_SW Wave Parks. Español.pdf | PHILAE | funding | unknown | 10 | 96 | a9148db6a2ab1d74 | 2026-04-12T12:13:02.052584+00:00 | `39cc9078-bf58-42d6-bb02-48974d2172ce` |
| 2 | 2025.09.19_SW Wave Parks. Español.pdf | PHILAE | funding | unknown | 10 | 111 | 0cc6deca405364b7 | 2026-04-12T12:11:58.394704+00:00 | `ae1adfc9-a3a3-4934-bc32-7a59c0ef4320` |

### 137 — financial-versions

Key: `20swwaveparksimenglish|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2025.10.09_SW Wave Parks_IM (English).pdf | PHILAE | funding | unknown | 10 | 104 | 6d5ec5f78e8c0652 | 2026-04-12T12:13:52.344216+00:00 | `3bfb3dd5-bd25-4de3-aa98-542929c3e772` |
| 2 | 2025.10.09_SW Wave Parks_IM (English).pdf | PHILAE | funding | unknown | 10 | 84 | 3ddfa1023774dacc | 2026-04-12T12:14:58.205951+00:00 | `45c88bcf-9758-43e6-9586-e6dc6879fe02` |

### 138 — financial-versions

Key: `2501mpsinformehipotesisdesviacionesbudgetst|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2501_MPS_Informe Hipotesis desviaciones Budget ST rev1.pdf | MAD | monitoring | working_paper | 85 | 13 | c0378a872417299a | 2026-04-12T13:54:23.459643+00:00 | `874c849f-b1c8-4157-a756-fda025560343` |
| 2 | 2501_MPS_Informe Hipotesis desviaciones Budget ST rev2.pdf | MAD | monitoring | working_paper | 85 | 15 | 8832f54fb2f6981a | 2026-04-12T13:54:00.271019+00:00 | `895dd9d5-43c3-4ca5-92f6-e94e4c69be13` |
| 3 | 2501_MPS_Informe Hipotesis desviaciones Budget ST rev2.docx | MAD | monitoring | working_paper | 85 | 29 | 2a9d4c48e0602b4e | 2026-04-12T13:53:54.039206+00:00 | `af79fcd5-8b85-4a84-996f-8306cc0c1d8c` |
| 4 | 2501_MPS_Informe Hipotesis desviaciones Budget ST rev1.docx | MAD | monitoring | working_paper | 85 | 24 | a1b851b7ed75f2fc | 2026-04-12T13:54:07.965559+00:00 | `b3aee56c-6d5d-4997-83d2-e1acd361cba3` |

### 139 — financial-versions

Key: `250718ecijaatmcontratoobrainstalacionedificiofaseiiconstruccionessanjosevf|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 25-07-18 ECIJA_ATM_ContratoObraInstalaciónEdificioFaseII_ConstruccionesSanJose_VF (1)_.pdf | MAD | monitoring | unknown | 90 | 140 | 233f2b3f59e60049 | 2026-04-12T14:41:04.629406+00:00 | `36e35d98-3891-4452-95fd-b2dff5ae5b2c` |
| 2 | 25-07-18 ECIJA_ATM_ContratoObraInstalaciónEdificioFaseII_ConstruccionesSanJose_VF (1) (1).pdf | MAD | legal | unknown | 95 | 2380 | 456d8b3c0c9d1dd4 | 2026-04-12T12:38:06.543929+00:00 | `9c61dd62-4448-4cb9-aa56-29da01aab10b` |

### 140 — financial-versions

Key: `2surfparkexposehighlineraugust2024|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2_Surfpark_Expose_Highliner_August 2024.pdf | GVF | funding | unknown | 10 | 19 | 4774780be55c746c | 2026-04-12T12:35:45.808057+00:00 | `b5e09c43-6d72-440f-b258-cfffd3fdabc6` |
| 2 | 2_Surfpark_Expose_Highliner_August 2024.pdf | GVF | funding | draft | 10 | 4 | 4697d998f84d3b0b | 2026-04-12T12:37:06.148411+00:00 | `deeb6c9d-1640-4fc5-b619-18e7893208b7` |

### 141 — financial-versions

Key: `3colliersreportfinal|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 3_Colliers_Report final.pdf | GVF | dd | executed | 90 | 167 | 97d0e59a42cfc662 | 2026-04-12T12:37:40.62867+00:00 | `0942f041-cac3-4685-a1fd-4cea8dbcaac6` |
| 2 | 3_Colliers_Report final.pdf | GVF | dd | executed | 90 | 162 | 48af9828895959b5 | 2026-04-12T12:35:53.279385+00:00 | `8b3f5b14-7733-4373-96f3-4d3d547ec470` |

### 142 — financial-versions

Key: `4sodareportfinal|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 4_Soda_Report_final.pdf | GVF | capex | executed | 40 | 33 | ab1c9ea2323d2629 | 2026-04-12T12:36:54.199555+00:00 | `0fe5ee5f-9d8d-47f2-be88-058b31b6482d` |
| 2 | 4_Soda_Report_final.pdf | GVF | capex | working_paper | 40 | 28 | 15973187e88a884a | 2026-04-12T12:38:03.175+00:00 | `1546b1b1-a699-400e-8806-bfb213760299` |

### 143 — financial-versions

Key: `5krefeldannualincomebudgetsurfingfinal|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 5_Krefeld Annual Income Budget Surfing FINAL.xlsx | GVF | bp_model | working_paper | 40 | 147 | 234e2cafecfe499b | 2026-04-12T12:38:19.903993+00:00 | `2586a52f-e6f6-48fc-8c9e-7e45ae67472c` |
| 2 | 5_Krefeld Annual Income Budget Surfing FINAL.xlsx | GVF | bp_model | working_paper | 40 | 132 | 1572456f3e6b21f4 | 2026-04-12T12:37:00.674122+00:00 | `39af2834-913b-442d-a94a-b1712456d35e` |

### 144 — financial-versions

Key: `a203modcroquismod2ampl|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | A-2-03_MOD_croquis_250227-MOD 2_AMPL.pdf | GVF | capex | draft | 40 | 105 | f06b7ef41ee915c9 | 2026-04-12T12:47:40.368888+00:00 | `1136b944-74cc-4cdb-a4d8-356b79dee07e` |
| 2 | A-2-03_MOD_croquis_250227-MOD 2_AMPL.pdf | GVF | capex | draft | 40 | 80 | 2b004d0ae284ff52 | 2026-04-12T12:46:48.980839+00:00 | `e2f5d5f1-2ec8-4d8a-a284-b72bcaba2426` |

### 145 — financial-versions

Key: `acta1reunionquincenalgemswellsurfmadrid|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240906_Acta 1ª Reunión Quincenal_Gemswell Surf Madrid.docx | MAD | monitoring | unknown | 80 | 3 | 0f21d10c62f2745a | 2026-04-12T13:38:32.571943+00:00 | `a143d820-4d44-4b15-b930-246f45b8ff18` |
| 2 | 20240906_Acta 1ª Reunión Quincenal_Gemswell Surf Madrid.pdf | MAD | monitoring | unknown | 80 | 6 | 6d04230dc6821bf3 | 2026-04-12T13:38:34.034328+00:00 | `ec5af45d-5110-4f2f-bf6e-71bbf2b86bf2` |

### 146 — financial-versions

Key: `alhpsarc0001r04preliminarymasterplanandhubreport|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | ALH-PS-ARC-0001-R04 Preliminary Masterplan and HUB Report.pdf | GVF | capex | draft | 40 | 21 | a041a699ec0bc06c | 2026-04-12T12:41:19.684754+00:00 | `2b6046c6-22a5-4a03-8d49-2ab6ff8b9613` |
| 2 | ALH-PS-ARC-0001-R04 Preliminary Masterplan and HUB Report.pdf | GVF | capex | draft | 40 | 11 | a877d7b02ec7aafd | 2026-04-12T12:39:56.519572+00:00 | `8a309842-046a-4e71-a052-9c8c76c85453` |

### 147 — financial-versions

Key: `balancesheetfeb26|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Balance sheet - Feb 26.xlsx | BHX | financial_statements | unknown | 0 | 2 | 32fef585e807bdef | 2026-06-04T14:11:06.514902+00:00 | `398e060c-0aed-4c44-957d-d57c6d6669b4` |
| 2 | Balance sheet - Feb 26.xlsx | BHX | financial_statements | working_paper | 40 | 2 | c320f3ba43414a58 | 2026-04-11T17:05:01.525859+00:00 | `ef0289c7-0c23-4083-a209-9ee397cb6219` |

### 148 — financial-versions

Key: `bpmodelbirmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240924_BP Model_Birmingham.xlsx | BHX | bp_model | working_paper | 40 | 37 | 7aa9bdbe1cd7d620 | 2026-04-11T18:22:05.261719+00:00 | `4ca97cdf-488a-49a8-9e9f-341c71ef3036` |
| 2 | BP Model_Birmingham v20.xlsx | BHX | bp_model | working_paper | 40 | 32 | f5c4547cec5543e1 | 2026-04-11T17:07:26.217716+00:00 | `4cd94e40-ddd4-40b3-ab00-7f90400dc106` |
| 3 | 20260123_BP Model_Birmingham v15.xlsx | BHX | bp_model | working_paper | 90 | 29 | b844cb6387eab8d4 | 2026-04-12T09:00:00.250651+00:00 | `64321948-db85-410f-9ae2-c9d2dba2b30c` |
| 4 | 20250121_BP Model_Birmingham v7.xlsx | BHX | bp_model | working_paper | 40 | 42 | 1075f5028df22512 | 2026-04-11T17:07:44.972193+00:00 | `6df9b086-a7c7-4f5b-b272-0d82aba8b13e` |

### 149 — financial-versions

Key: `bpmodelmadridplayasurf|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250516_BP Model_Madrid Playa Surf v18.xlsx | MAD | bp_model | working_paper | 85 | 31 | a0073120b92dc162 | 2026-04-12T11:21:44.355101+00:00 | `50d4b019-0c6e-47ca-9051-68553e57f8d6` |
| 2 | 20250214_BP Model_Madrid Playa Surf v10.xlsx | MAD | bp_model | working_paper | 85 | 35 | bd45b3f49a17eae3 | 2026-04-12T11:17:14.387535+00:00 | `ad2e6983-156d-4bba-9413-7ad794e06a26` |

### 150 — financial-versions

Key: `bpopcovsgc|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V090225_vSGC.xlsx | GVF | bp_model | unknown | 85 | 10 | 648e2ced1d55d90f | 2026-04-12T12:13:07.229347+00:00 | `a1d1d043-fe99-4f07-af62-85f68491abe7` |
| 2 | BP_OPCO_V090225_vSGC.xlsx | GVF | bp_model | unknown | 85 | 21 | 9c5d7d3ebd338647 | 2026-04-12T12:11:44.733638+00:00 | `cd779602-e8e8-400f-ae2d-1c2dc251d20c` |

### 151 — financial-versions

Key: `bpopcovsgcv10|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V250425_vSGC_v10.xlsx | GVF | bp_model | unknown | 85 | 7 | 5916f5f024d31802 | 2026-04-12T12:13:09.62652+00:00 | `777d061c-de6c-4e07-bf36-518e4d431d8e` |
| 2 | BP_OPCO_V250425_vSGC_v10.xlsx | GVF | bp_model | unknown | 85 | 10 | 0d7fd7fc838cffef | 2026-04-12T12:14:58.47656+00:00 | `ea223b29-b166-491d-8bde-93914cb18135` |

### 152 — financial-versions

Key: `bpopcovsgcv11|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V250514_vSGC_v11.xlsx | GVF | bp_model | unknown | 85 | 23 | d786dafbf6962ea2 | 2026-04-12T12:13:44.417339+00:00 | `f6f8d07f-070c-4378-8c2e-1521bce43cea` |
| 2 | BP_OPCO_V250514_vSGC_v11.xlsx | GVF | bp_model | unknown | 85 | 18 | 07455161bf980c6e | 2026-04-12T12:15:32.274734+00:00 | `f7861cdd-7b23-4f9b-be28-dcfeebcf9493` |

### 153 — financial-versions

Key: `bpopcovsgcv5|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V160325_vSGC_v5.xlsx | GVF | bp_model | unknown | 85 | 12 | c068e248d23f67af | 2026-04-12T12:12:09.559799+00:00 | `e0e63c3c-5706-462c-9d5e-3519d09b51c5` |
| 2 | BP_OPCO_V160325_vSGC_v5.xlsx | GVF | bp_model | unknown | 85 | 12 | a5b9d02dc0230c53 | 2026-04-12T12:14:08.073391+00:00 | `f985854d-db2f-41be-b42a-290652488d11` |

### 154 — financial-versions

Key: `bpopcovsgcv7|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V040425_vSGC_v7.xlsx | GVF | bp_model | unknown | 85 | 26 | 714167b77ad60810 | 2026-04-12T12:12:57.792167+00:00 | `38361fd4-6547-40de-93a7-4ea5481d51cc` |
| 2 | BP_OPCO_V040425_vSGC_v7.xlsx | GVF | bp_model | unknown | 85 | 21 | 96223dd7c7a7bcef | 2026-04-12T12:11:25.094753+00:00 | `bbead63a-a80b-461f-81eb-f7ff7ae52f90` |

### 155 — financial-versions

Key: `bpopcovsgcvgoyoexe|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V250527_vSGC_vGOYO_EXE.xlsx | GVF | bp_model | unknown | 85 | 23 | 8117a0af7370d05a | 2026-04-12T12:14:42.760905+00:00 | `1a4ad251-8ffb-4f87-bd95-5591004da039` |
| 2 | BP_OPCO_V250526_vSGC_vGOYO_EXE.xlsx | GVF | bp_model | unknown | 85 | 23 | 5a95768d1fb946ac | 2026-04-12T12:16:02.220586+00:00 | `3a5de9ad-fac8-4b5b-872b-6bc95c223564` |
| 3 | BP_OPCO_V250527_vSGC_vGOYO_EXE.xlsx | GVF | bp_model | unknown | 85 | 8 | efcf7c29f787428c | 2026-04-12T12:16:08.664913+00:00 | `64fc1830-42cb-45a0-9487-579a67df2d65` |

### 156 — financial-versions

Key: `bpopcovtbdexe|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BP_OPCO_V250619_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 23 | 500afe9c3ce60ee1 | 2026-04-12T12:16:51.384565+00:00 | `0b3755cb-20ce-4840-9b5c-b3228851c93a` |
| 2 | BP_OPCO_V250909_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 28 | 962ad176eff86480 | 2026-04-12T12:15:55.915605+00:00 | `33267d09-fd73-48d0-b0e9-66b1418b3933` |
| 3 | BP_OPCO_V251222_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 26 | 90222528157700fa | 2026-04-12T12:18:45.019978+00:00 | `3907d1c0-35a4-45d8-8e28-431ea94c516c` |
| 4 | BP_OPCO_V260325_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 27 | 2d0a67998646e037 | 2026-04-12T12:19:44.593598+00:00 | `57dda716-a18c-411e-ad35-9ee464db4e7d` |
| 5 | BP_OPCO_V260202_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 26 | e862bcc023e6de8a | 2026-04-12T12:18:58.416008+00:00 | `588e8b60-9bb9-4798-8965-c10c0d2fea4f` |
| 6 | BP_OPCO_V260122_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 26 | d25ba87c8730c304 | 2026-04-12T12:18:51.293757+00:00 | `69d6bf83-0df5-46b2-ba2b-73becdc5f8d7` |
| 7 | BP_OPCO_V250708_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 3 | 85c5ca2aa3faf13d | 2026-04-12T12:16:55.23067+00:00 | `85f460ff-7b59-4f9f-9261-2a0a3dfa3c38` |
| 8 | BP_OPCO_V250609_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 23 | 6b413b51369ee1d1 | 2026-04-12T12:14:53.569237+00:00 | `9c24f653-15bf-4b37-9e30-ad42381c8ef4` |
| 9 | BP_OPCO_V250708_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 23 | 1d4c6adcd7f2cbd6 | 2026-04-12T12:15:43.622955+00:00 | `a057377b-c3dd-47e1-886a-71f394603ad8` |
| 10 | BP_OPCO_V260306_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 27 | 0c8e1a96cf0df74e | 2026-04-12T12:19:40.294823+00:00 | `a93b7eb1-0d94-4df0-a3ff-7fb37786105d` |
| 11 | BP_OPCO_V251105_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 21 | e6542a0e2121923e | 2026-04-12T12:18:29.143208+00:00 | `ad5544ee-412b-4ca5-a31c-f95dddff2c58` |
| 12 | BP_OPCO_V260224_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 17 | 13b9e325f04cdec9 | 2026-04-12T12:20:25.376705+00:00 | `af2949f2-9439-448f-aa27-ab06cd484a9e` |
| 13 | BP_OPCO_V251105_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 26 | c9072f4a05ed88b8 | 2026-04-12T12:19:43.824736+00:00 | `af3da934-db33-4804-8d22-8789277d8c9e` |
| 14 | BP_OPCO_V251117_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 26 | 19351af94a1058c0 | 2026-04-12T12:07:40.579869+00:00 | `b8501113-5ef0-4e5b-8c21-5470dd40049f` |
| 15 | BP_OPCO_V260224_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 12 | 3c68775b45a1cb60 | 2026-04-12T12:19:05.098682+00:00 | `de1daba1-6d18-4694-aec1-9bf54a4b1ad9` |
| 16 | BP_OPCO_V260202_vTBD_EXE.xlsx | GVF | bp_model | unknown | 85 | 20 | 850d21435b7ce891 | 2026-04-12T12:20:00.318684+00:00 | `f2688727-bae7-4487-b1f3-2d014a3fd812` |

### 157 — financial-versions

Key: `bpreportingmodelmadridsurfpark|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260216_BP Reporting Model_Madrid Surf Park v29.xlsx | MAD | bp_model | working_paper | 85 | 39 | e65f8d5f2bfb18bd | 2026-04-12T11:24:05.999797+00:00 | `0ad3d30d-44fe-429c-8385-9618a213c00b` |
| 2 | 20251202_BP Reporting Model_Madrid Surf Park v27.xlsx | MAD | bp_model | working_paper | 85 | 31 | 10a05ba652bb2e08 | 2026-04-12T11:23:30.01504+00:00 | `112d7c43-d1c2-4695-ac29-5c8924ae395e` |
| 3 | 20260407_BP Reporting Model_Madrid Surf Park v292.xlsx | MAD | bp_model | working_paper | 85 | 49 | 21a0c2f7874ad573 | 2026-04-12T11:24:24.412248+00:00 | `1cf5b499-6eed-4f4a-bee6-782e6151a521` |
| 4 | 20260115_BP Reporting Model_Madrid Surf Park v28.xlsx | MAD | bp_model | working_paper | 85 | 37 | 23373a8a3edb4bd6 | 2026-04-12T11:23:47.637852+00:00 | `688c3879-1c9e-4748-adb6-9c846c8fe505` |
| 5 | 20250929_BP Reporting Model_Madrid Surf Park v23.xlsx | MAD | bp_model | working_paper | 85 | 29 | b0f2a980d4e1e225 | 2026-04-12T11:22:37.488293+00:00 | `73523773-300e-412f-913d-2afd7371c4a8` |
| 6 | 20250717_BP Reporting Model_Madrid Surf Park v20.xlsx | MAD | bp_model | working_paper | 85 | 29 | 8f7b2020f2af677d | 2026-04-12T11:21:56.601278+00:00 | `88c11ba9-afcb-4e0f-9183-13d3a53cd278` |
| 7 | 20250924_BP Reporting Model_Madrid Surf Park v22.xlsx | MAD | bp_model | working_paper | 85 | 29 | 8dd0b0754461d61f | 2026-04-12T11:22:25.541868+00:00 | `890f8ac2-b0fb-4788-8845-29e1a0b5133b` |
| 8 | 20250619_BP Reporting Model_Madrid Surf Park v19.xlsx | MAD | bp_model | working_paper | 85 | 25 | 1e642cf7a62deef4 | 2026-04-12T11:17:33.034081+00:00 | `b7ba9545-fdcd-4b46-9bb4-c591db9e4ee8` |
| 9 | 20250910_BP Reporting Model_Madrid Surf Park v21.xlsx | MAD | bp_model | working_paper | 85 | 29 | 24745baca5164c0e | 2026-04-12T11:22:08.292353+00:00 | `c9ed7ba7-df7d-460c-9589-daed57a80fea` |
| 10 | 20251013_BP Reporting Model_Madrid Surf Park v25.xlsx | MAD | bp_model | working_paper | 85 | 28 | 5f5ed4c4d39f170c | 2026-04-12T11:23:01.000297+00:00 | `cf906419-3ddb-4543-af50-6169a4bbfe58` |
| 11 | 20251008_BP Reporting Model_Madrid Surf Park v24.xlsx | MAD | bp_model | working_paper | 85 | 28 | 713d09538a02575a | 2026-04-12T11:22:49.311913+00:00 | `d508bc5d-5998-4bd4-8b9c-2b47058f3d91` |
| 12 | 20251107_BP Reporting Model_Madrid Surf Park v26.xlsx | MAD | bp_model | working_paper | 85 | 30 | 8b20aedbf9b6961e | 2026-04-12T11:23:12.67841+00:00 | `efefdfa5-86f4-4364-adae-ff42a2d2eaec` |

### 158 — financial-versions

Key: `buckinghamconstructionprogrammerefresh|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Buckingham Construction Programme Refresh.pdf | BHX | legal | executed | 90 | 57 | 4e5d38a079be94f2 | 2026-04-11T18:43:09.557539+00:00 | `19c0b786-fc8c-47f8-bc25-5391905e33bf` |
| 2 | Buckingham Construction Programme Refresh.pdf | BHX | capex | working_paper | 40 | 19 | 37838b07eeaf9a00 | 2026-04-11T20:05:53.432824+00:00 | `65272722-6b73-4d03-991d-f10b7ff359a1` |

### 159 — financial-versions

Key: `budget2027gemswellsurfmadrid|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Budget 2027 Gemswell Surf Madrid_Duplicate.xlsx | MAD | bp_model | working_paper | 85 | 33 | a713c0f6368ad5e3 | 2026-04-12T11:18:40.846774+00:00 | `42e3b717-2197-4d4b-b1b6-20369487caf4` |
| 2 | Budget 2027 Gemswell Surf Madrid v2.xlsx | MAD | bp_model | working_paper | 85 | 36 | 57e0a35e742b9520 | 2026-04-12T11:18:27.343414+00:00 | `91419fe1-2f07-45fe-a63b-724c846772fd` |

### 160 — financial-versions

Key: `budgetmarketing|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Budget Marketing V2.xlsx | GVF | bp_model | working_paper | 85 | 12 | 23a2c29ac3a6f359 | 2026-04-12T12:16:04.860643+00:00 | `2a9023c1-0730-4ab5-8a6a-094df142ef9b` |
| 2 | Budget Marketing V1.xlsx | GVF | bp_model | working_paper | 85 | 8 | 7d5256beadc74465 | 2026-04-12T12:16:02.544085+00:00 | `da61831f-33ec-4989-9042-632eb1ba9cca` |

### 161 — financial-versions

Key: `capexmonitoringcf|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260312_CapEx Monitoring CF.xlsx | MAD | cash_flow | unknown | 85 | 15 | 25f2b6cfc23e165b | 2026-04-12T11:06:21.892324+00:00 | `445e8dfa-c2d5-4d99-947e-40fdc530f3b2` |
| 2 | 20260324_CapEx Monitoring CF.xlsx | MAD | cash_flow | unknown | 85 | 28 | e36e71ce182b89c6 | 2026-04-12T11:06:40.172622+00:00 | `56b57ac1-afcf-4685-8207-a75a95625dac` |
| 3 | 20260330_CapEx Monitoring CF.xlsx | MAD | capex | working_paper | 40 | 26 | 32b6e97451a7f1b4 | 2026-04-11T18:51:05.145233+00:00 | `c192e1a1-3f4a-460d-a7e9-424a3ea07a07` |

### 162 — financial-versions

Key: `cartaadjudicacion|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250513 Carta Adjudicación (clean).docx | MAD | monitoring | unknown | 85 | 4 | 1e07894b7cb0fdde | 2026-04-12T14:38:09.35331+00:00 | `03b2fb7b-998b-47de-8a37-c026bf40098d` |
| 2 | 20250512 Carta Adjudicación (clean).docx | MAD | monitoring | unknown | 85 | 4 | 7c8f4185628f0530 | 2026-04-12T14:38:06.819757+00:00 | `35910cf8-cdc3-4611-9d35-061dac16d839` |
| 3 | 20250512 Carta Adjudicación (clean).pdf | MAD | monitoring | unknown | 85 | 4 | bfc105f8b07c3d47 | 2026-04-12T14:38:08.090337+00:00 | `3ace767b-99ce-4c9b-ac7f-124856fe2820` |
| 4 | 20250513 Carta Adjudicación (clean).pdf | MAD | monitoring | unknown | 85 | 6 | d75f1a45800630bb | 2026-04-12T14:38:10.745078+00:00 | `650bcd4e-1ca4-4031-b555-dc53eb1b4209` |
| 5 | 20250508 Carta Adjudicación rev 0003.docx | MAD | monitoring | unknown | 85 | 4 | 5f8f71f0a99bcef4 | 2026-04-12T14:38:05.59892+00:00 | `7aeffd48-43fd-4440-bcc4-5456e30e9398` |
| 6 | 20250508 Carta Adjudicación (1) rev 0001.docx | MAD | monitoring | unknown | 85 | 4 | 620bfbd67c4eab6b | 2026-04-12T14:38:03.087034+00:00 | `7fcdf6b3-9a78-49cf-ac54-252b7edd69fb` |
| 7 | 20250508 Carta Adjudicación rev 0002.docx | MAD | monitoring | unknown | 85 | 4 | c30cd88938e0e6f2 | 2026-04-12T14:38:04.346469+00:00 | `9ca3b10b-9948-46a7-bf6a-a8c997fd0ab4` |

### 163 — financial-versions

Key: `cin201edificiosurfcarpinteriametalicaplantabajorasante|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CIN.2.01 - EDIFICIO SURF - CARPINTERIA METÁLICA - PLANTA BAJO RASANTE-rev1.pdf | MAD | monitoring | unknown | 85 | 5 | abbdefa7a9970d89 | 2026-04-12T14:03:56.512399+00:00 | `1ed3602b-c0bc-4f19-8470-a20d657a93d1` |
| 2 | CIN.2.01 - EDIFICIO SURF - CARPINTERIA METÁLICA - PLANTA BAJO RASANTE-rev2.pdf | MAD | monitoring | unknown | 85 | 6 | fd5da515912a0a32 | 2026-04-12T14:22:04.876214+00:00 | `61af0fb0-664d-45df-bb91-30303e092a55` |

### 164 — financial-versions

Key: `cin202edificiosurfcarpinteriametalicaplantasobrerasanteycubierta|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CIN.2.02 - EDIFICIO SURF - CARPINTERIA METÁLICA - PLANTA SOBRE RASANTE Y CUBIERTA-.pdf | MAD | monitoring | unknown | 85 | 3 | 2e8d73fe10d02723 | 2026-04-12T14:03:58.014434+00:00 | `65912c0b-1ae7-467e-8f17-38cf2e605968` |
| 2 | CIN.2.02 - EDIFICIO SURF - CARPINTERIA METÁLICA - PLANTA SOBRE RASANTE Y CUBIERTA-rev1.pdf | MAD | monitoring | unknown | 85 | 3 | 1c32617cdecf6e6e | 2026-04-12T14:22:07.324905+00:00 | `d5ff9d2f-0d5b-4048-92f0-ebc5e177aa15` |

### 165 — financial-versions

Key: `cin203edificiosurfcarpinteriamaderayvidrioplantabajorasante|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CIN.2.03 - EDIFICIO SURF - CARPINTERIA MADERA Y VIDRIO - PLANTA BAJO RASANTE-.pdf | MAD | monitoring | unknown | 85 | 3 | 10854d7a4b455a9d | 2026-04-12T14:03:59.470049+00:00 | `36cb2ca7-7b9b-4a0b-97f3-059a49e9767a` |
| 2 | CIN.2.03 - EDIFICIO SURF - CARPINTERIA MADERA Y VIDRIO - PLANTA BAJO RASANTE-rev1.pdf | MAD | monitoring | unknown | 85 | 4 | d6a4bd8a65037cfb | 2026-04-12T14:22:08.754202+00:00 | `a1aca4dc-09d6-415b-9b6a-fd416c1a7f87` |

### 166 — financial-versions

Key: `cin204edificiosurfcarpinteriamaderayvidrioplantasobrerasanteycubierta|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CIN.2.04 - EDIFICIO SURF - CARPINTERIA MADERA Y VIDRIO - PLANTA SOBRE RASANTE Y CUBIERTA-.pdf | MAD | monitoring | unknown | 85 | 3 | d23b5a82e9e448bf | 2026-04-12T14:04:01.012577+00:00 | `675de34d-d7f8-4b7e-82a2-7a0b70da2272` |
| 2 | CIN.2.04 - EDIFICIO SURF - CARPINTERIA MADERA Y VIDRIO - PLANTA SOBRE RASANTE Y CUBIERTA-rev1.pdf | MAD | monitoring | unknown | 85 | 3 | 5446eb7bbd4116a4 | 2026-04-12T14:22:10.278723+00:00 | `feacf44f-6936-47b5-97f1-f7f6b0845950` |

### 167 — financial-versions

Key: `cin205edificiosurfdetallescarpinteriainteriores|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CIN.2.05 - EDIFICIO SURF - DETALLES CARPINTERIA INTERIORES.pdf | MAD | monitoring | unknown | 85 | 15 | bc4aa2ecf4873baf | 2026-04-12T14:04:02.323607+00:00 | `5d109bea-842d-4e8d-8808-775edffe8dda` |
| 2 | CIN.2.05 - EDIFICIO SURF - DETALLES CARPINTERIA INTERIORES-rev1.pdf | MAD | monitoring | unknown | 85 | 15 | a78a3e30342e59b6 | 2026-04-12T14:22:11.56144+00:00 | `e6567799-3799-4e7d-b76c-4321744ff284` |

### 168 — financial-versions

Key: `contratoejecucionobrasconstrcciondeinstalacionyedificiofaseii|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | BORRADOR CONTRATO EJECUCIÓN OBRAS Constrcción de instalación y edificio (Fase II) V4.docx | MAD | monitoring | unknown | 85 | 81 | 41825b38ad1edaf9 | 2026-04-12T14:41:34.824729+00:00 | `7f082d4b-3c00-472e-a649-6e35f86d781d` |
| 2 | BORRADOR CONTRATO EJECUCIÓN OBRAS Constrcción de instalación y edificio (Fase II) V6.docx | MAD | monitoring | unknown | 85 | 82 | 8c1f257ace6a6ff8 | 2026-04-12T14:41:43.291213+00:00 | `98266677-5119-4cd9-9c9f-566fd0569be2` |

### 169 — financial-versions

Key: `crr201edificiosurfcerrajeriaplantabajorasante|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | CRR.2.01 - EDIFICIO SURF - CERRAJERIA - PLANTA BAJO RASANTE-rev2.pdf | MAD | monitoring | unknown | 85 | 4 | afd134d2b4a5bb56 | 2026-04-12T14:22:13.837075+00:00 | `830cf91c-3cc7-4fab-997d-480ac6ed3fd6` |
| 2 | CRR.2.01 - EDIFICIO SURF - CERRAJERIA - PLANTA BAJO RASANTE-rev1.pdf | MAD | monitoring | unknown | 85 | 4 | 61d8ed0e969f3c41 | 2026-04-12T14:04:22.20033+00:00 | `a1b425fc-0da0-4ed7-81a0-8fdd3fad4bbb` |

### 170 — financial-versions

Key: `desktopenvironmentalsiteassessmentwavegardenbirmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Desktop Environmental Site Assessment - Wavegarden, Birmingham.pdf | BHX | dd | executed | 40 | 55 | 2b67b5a7f39ff653 | 2026-04-11T20:04:43.135037+00:00 | `c1ac506a-ca8c-4b8d-a7f0-6c9a32d3a052` |
| 2 | Desktop Environmental Site Assessment - Wavegarden, Birmingham.pdf | BHX | dd | working_paper | 40 | 1 | f45cf3f95953caea | 2026-04-11T18:44:15.400556+00:00 | `cf1444c4-b4a2-48d9-bd02-c62a83d13ca2` |

### 171 — financial-versions

Key: `emergesurfbhamukcolliersddfinancialsfinal|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Emerge Surf Bham UK - Colliers DD Financials - Final Draft 221123.pdf | GVF | dd | draft | 60 | 55 | 2b67b5a7f39ff653 | 2026-04-11T18:45:11.002874+00:00 | `be345e29-21d5-417d-837e-30d7b295015a` |
| 2 | Emerge Surf Bham UK - Colliers DD Financials - Final Draft 221123.pdf | GVF | dd | draft | 60 | 95 | d7b4e2e80927acc3 | 2026-04-11T20:06:03.076917+00:00 | `fee38e7a-886e-4523-bf20-197f1ffddf59` |

### 172 — financial-versions

Key: `emergesurfstage3costplanrevawithprices|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Emergesurf - Stage 3 Cost Plan Rev.A - 11.07.24 DRAFT with prices.pdf | BHX | capex | draft | 40 | 110 | 2b0ee8b2b97950c7 | 2026-04-12T08:47:12.888074+00:00 | `51d73011-76f0-4489-bf0d-fd6b94ce92ae` |
| 2 | Emergesurf - Stage 3 Cost Plan Rev.A - 11.07.24 DRAFT with prices.pdf | BHX | capex | draft | 40 | 110 | 4d3c2470e4549585 | 2026-04-12T08:46:29.256541+00:00 | `65334f3c-28e3-424f-88d3-be672129df9b` |

### 173 — financial-versions

Key: `eq02mobiliarioedificiosurfplantabaja|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | EQ.02-MOBILIARIO-EDIFICIO SURF-PLANTA BAJA.pdf | MAD | monitoring | unknown | 85 | 7 | c3e938808f59c1e4 | 2026-04-12T14:04:28.822852+00:00 | `1537a72d-ec68-4b1b-82c9-7630681c53af` |
| 2 | EQ.02-MOBILIARIO-EDIFICIO SURF-PLANTA BAJA-rev2.pdf | MAD | monitoring | unknown | 85 | 8 | d44494a51b6d068b | 2026-04-12T14:22:53.140637+00:00 | `f3372d18-ae1b-4c4c-9701-cd469b0a32e5` |

### 174 — financial-versions

Key: `extractocontratoejecucionobrasconfasepreliminarmps|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | (Extracto) Contrato ejecución obras con fase preliminar MPS.docx | MAD | monitoring | unknown | 90 | 81 | 5305c72f82968b2f | 2026-04-12T14:37:34.69272+00:00 | `345cb11d-2196-45d3-b76a-f1e0bcf6fb75` |
| 2 | (Extracto) Contrato ejecución obras con fase preliminar MPS.pdf | MAD | monitoring | unknown | 90 | 34 | 7c459d57ae94a2b4 | 2026-04-12T14:37:43.709011+00:00 | `f73b1f43-2791-4a0e-be1e-5eb0dcdbf6dc` |

### 175 — financial-versions

Key: `facturademiraok|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Factura 20240191_Demira -OK.pdf | MAD | financial_statements | unknown | 90 | 1 | eb842d0b46302cd8 | 2026-04-12T12:14:54.87121+00:00 | `69198c01-1ba8-4ba0-87ce-48c7a4568f13` |
| 2 | Factura 20240242_Demira -OK.pdf | MAD | financial_statements | unknown | 90 | 5 | 4eaf2db2827c0d81 | 2026-04-12T12:14:56.955349+00:00 | `cc36c6ed-6457-4628-89eb-69d626bc29ce` |

### 176 — financial-versions

Key: `gemswellbirminghambudgetestimation|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Birmingham_Budget Estimation_.pdf | BHX | capex | draft | 40 | 36 | 6892f69bf99aea14 | 2026-04-11T23:12:59.761153+00:00 | `028509b3-cc9e-4eda-8392-cddc775f224f` |
| 2 | Gemswell Birmingham_Budget Estimation_.xlsx | BHX | capex | working_paper | 40 | 11 | d03f5171f1ec4196 | 2026-04-11T18:51:45.807088+00:00 | `bd230018-635b-47be-bc3b-496fdb0ed41e` |

### 177 — financial-versions

Key: `gemswellfinancials02|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 02.pdf | PHILAE | funding | working_paper | 10 | 24 | be7e7252417a4cad | 2026-04-12T12:14:13.607411+00:00 | `28180785-fb48-48f0-9b5f-4d2ded270353` |
| 2 | Gemswell Financials 02.pdf | PHILAE | funding | draft | 10 | 39 | ed033f6f212fc2c2 | 2026-04-12T12:15:54.728143+00:00 | `dcffde56-d9e4-4a9e-b147-be7b68bf2624` |

### 178 — financial-versions

Key: `gemswellfinancials04|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 04 240812.pdf | PHILAE | funding | working_paper | 10 | 216 | ba7e882707fe8dc2 | 2026-04-12T12:15:57.606503+00:00 | `1fa98e5c-18d2-4a29-8835-ed6417108ca7` |
| 2 | Gemswell Financials 04 240812.pdf | PHILAE | bp_model | working_paper | 40 | 211 | 898345ac8a10b8db | 2026-04-12T12:16:57.430651+00:00 | `ad66b5cc-e90c-4705-b542-95f304896ce5` |

### 179 — financial-versions

Key: `gemswellfinancials04cris|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 04 240812 Cris.pdf | PHILAE | funding | draft | 10 | 211 | e1790a518a555980 | 2026-04-12T12:16:03.133016+00:00 | `1d8521f4-b471-4314-8bdc-083f8d8fdaf8` |
| 2 | Gemswell Financials 04 240812 Cris.pdf | PHILAE | funding | draft | 10 | 206 | 0e81f34eeeb27adf | 2026-04-12T12:14:50.251563+00:00 | `6a681d34-b80d-4e72-b7e8-81d57aa418f4` |

### 180 — financial-versions

Key: `gemswellfinancials04sgc|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 04 240812_SGC.pdf | PHILAE | funding | working_paper | 10 | 216 | 2e64834fdd74003d | 2026-04-12T12:18:02.668937+00:00 | `9afb956e-76d9-4a1b-9bc7-3bf1d861adff` |
| 2 | Gemswell Financials 04 240812_SGC.pdf | PHILAE | funding | working_paper | 10 | 211 | 8036978c4773f3ed | 2026-04-12T12:16:53.930047+00:00 | `da7cdcb5-7823-43f2-bca2-7428363c25f8` |

### 181 — financial-versions

Key: `gemswellfinancials05|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 05 240905.pdf | PHILAE | bp_model | working_paper | 40 | 210 | e3f71f65c68a5972 | 2026-04-12T12:21:02.010896+00:00 | `29fd8dbc-29b4-49b1-a451-ea68a0f1c7ca` |
| 2 | Gemswell Financials 05 240905.pdf | PHILAE | funding | unknown | 10 | 210 | 83499c3915639384 | 2026-04-12T12:19:54.290747+00:00 | `3807c694-8403-4ab3-a45a-8dba3ac7c643` |
| 3 | Gemswell Financials 05 240911.pdf | PHILAE | bp_model | working_paper | 40 | 218 | 32283bdb2b3252d7 | 2026-04-12T12:22:05.769941+00:00 | `3f7be4ba-6df4-4738-bfff-bf6453e9a408` |
| 4 | Gemswell Financials 05 240913.pdf | PHILAE | bp_model | working_paper | 40 | 193 | dee427139fcf8822 | 2026-04-12T12:23:01.129433+00:00 | `48052e3d-a238-4c71-a2c4-fe19cd1697ae` |
| 5 | Gemswell Financials 05 240825.pdf | PHILAE | funding | unknown | 10 | 219 | 03bf8c9df4e9d74a | 2026-04-12T12:18:58.520612+00:00 | `5898bbfc-5499-475c-b95d-9629ee9951b6` |
| 6 | Gemswell Financials 05 240825.pdf | PHILAE | funding | unknown | 10 | 219 | 22f717e5708fb6ec | 2026-04-12T12:18:00.109891+00:00 | `73521fe9-248f-4caf-8ec8-915f4d252eb2` |
| 7 | Gemswell Financials 05 240910.pdf | PHILAE | bp_model | working_paper | 40 | 210 | fee9706d0dd06fec | 2026-04-12T12:22:08.209062+00:00 | `8591273d-32be-4161-b4c8-ed1175644869` |
| 8 | Gemswell Financials 05 240829.pdf | PHILAE | funding | unknown | 10 | 210 | 53603d3213e1a119 | 2026-04-12T12:19:57.208292+00:00 | `92be6da9-33b0-475d-9395-4c123f666d58` |
| 9 | Gemswell Financials 05 240913.pdf | PHILAE | funding | unknown | 10 | 218 | e2a4c5401d8cf012 | 2026-04-12T12:24:48.878768+00:00 | `c8a604dd-9969-48b2-a6eb-6c7da18a8532` |
| 10 | Gemswell Financials 05 240911.pdf | PHILAE | bp_model | working_paper | 40 | 198 | aaa53c8003b84698 | 2026-04-12T12:23:14.588097+00:00 | `e10b375b-dda9-4f05-8b5e-ab4f103642d6` |
| 11 | Gemswell Financials 05 240910.pdf | PHILAE | funding | unknown | 10 | 210 | 7d1afbaea8dbb2c8 | 2026-04-12T12:20:57.822754+00:00 | `e6349bbf-ed41-4b32-8e7d-35e0509be337` |
| 12 | Gemswell Financials 05 240829.pdf | PHILAE | funding | unknown | 10 | 215 | 1879096ec9904caf | 2026-04-12T12:18:57.30689+00:00 | `f080ec9d-6d74-4721-89a6-a13680ec59da` |

### 182 — financial-versions

Key: `gemswellfinancials05gv|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials 05 240913 GV.pdf | PHILAE | funding | unknown | 10 | 208 | 4c9605bada91134c | 2026-04-12T12:40:46.072294+00:00 | `0a2f607e-3ce8-45d6-a9eb-01a0e5f1471f` |
| 2 | Gemswell Financials 05 240913 GV.pdf | PHILAE | funding | unknown | 10 | 208 | 2c1ad971be37d57d | 2026-04-12T12:40:41.793098+00:00 | `3781f374-8dd3-4a1c-ad03-e83c61d37134` |
| 3 | Gemswell Financials 05 240911 GV.pdf | PHILAE | funding | unknown | 10 | 213 | 4876c77d1a7c41f3 | 2026-04-12T12:39:39.612522+00:00 | `751c0b9a-c063-41fb-ad1c-f079d600c581` |
| 4 | Gemswell Financials 05 240916 GV.pdf | PHILAE | funding | unknown | 10 | 218 | e5bf7d9164e66986 | 2026-04-12T12:42:00.329257+00:00 | `789ca9c9-601e-4f0f-aac3-7138fd5569a7` |
| 5 | Gemswell Financials 05 240916 GV.pdf | PHILAE | funding | unknown | 10 | 213 | 504cc628a12c1a57 | 2026-04-12T12:41:56.241567+00:00 | `bf5bac43-ed8f-4ea4-acfd-d28c1a1147f7` |
| 6 | Gemswell Financials 05 240911 GV.pdf | PHILAE | funding | unknown | 10 | 193 | b30dfbf6e4bf483d | 2026-04-12T12:38:57.252851+00:00 | `d2ebdf50-dd2c-4f70-af89-affa091991a3` |

### 183 — financial-versions

Key: `gemswellfinancialscast01|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials_CAST_241127_01.pdf | PHILAE | financial_statements | unknown | 70 | 300 | 09b823d6ee8f7fe0 | 2026-04-12T12:34:12.882286+00:00 | `07b1b287-d08e-4132-adb3-d8efdf7ded08` |
| 2 | Gemswell Financials_CAST_241125_01.pdf | PHILAE | funding | unknown | 10 | 268 | aff95a8f8b8662f0 | 2026-04-12T12:32:14.548141+00:00 | `281479af-7bf6-4196-a692-10859b2d6864` |
| 3 | Gemswell Financials_CAST_241107_01.pdf | PHILAE | financial_statements | working_paper | 40 | 282 | 94be62bd7b7819ec | 2026-04-12T12:31:12.390069+00:00 | `62b442e3-04c8-4f3c-91ed-1d727bd2ac5b` |
| 4 | Gemswell Financials_CAST_241127_01.pdf | PHILAE | funding | working_paper | 70 | 300 | f410443282c20e8e | 2026-04-12T12:33:48.015946+00:00 | `7b2d23f3-2df4-4123-aa6f-2fd6be5630ec` |
| 5 | Gemswell Financials_CAST_241125_01.pdf | PHILAE | bp_model | working_paper | 40 | 273 | a264d3f6c5fa49c0 | 2026-04-12T12:32:48.058172+00:00 | `860296d7-d658-4504-8e97-c49dd380702b` |
| 6 | Gemswell Financials_CAST_241129_01.pdf | PHILAE | funding | unknown | 10 | 273 | c66a4d149caae469 | 2026-04-12T12:35:04.332023+00:00 | `ae62aecb-2d66-4373-ac29-dcbef8d0907e` |
| 7 | Gemswell Financials_CAST_241129_01.pdf | PHILAE | funding | unknown | 10 | 273 | 66eb4ac7bb29e809 | 2026-04-12T12:34:41.508956+00:00 | `f890c3a1-8f79-4110-ada7-d1524ff5fc72` |
| 8 | Gemswell Financials_CAST_241107_01.pdf | PHILAE | funding | unknown | 10 | 292 | 0f5489d9f3fdfab4 | 2026-04-12T12:32:03.766616+00:00 | `fc077342-d85b-44c0-bbac-7141098af190` |

### 184 — financial-versions

Key: `gemswellfinancialscast02|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials CAST 02.pdf | PHILAE | funding | unknown | 70 | 204 | 569a4324a0c5e000 | 2026-04-12T12:25:45.357001+00:00 | `5da87f16-3c4f-40d7-a50c-2b098e5fb859` |
| 2 | Gemswell Financials CAST 02.pdf | PHILAE | funding | unknown | 70 | 214 | 6fe9ddf3cf9dadac | 2026-04-12T12:24:45.404139+00:00 | `d7deb190-3406-4e07-94c0-8e3c66571c9e` |

### 185 — financial-versions

Key: `gemswellfinancialseng01|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials ENG_241107_01.pdf | PHILAE | bp_model | working_paper | 40 | 259 | 300c3fda83252ee6 | 2026-04-12T12:27:01.286741+00:00 | `979cd97e-e564-433c-a708-aa9b6410c3c7` |
| 2 | Gemswell Financials ENG_241107_01.pdf | PHILAE | funding | unknown | 10 | 270 | 7ef422831f7150a4 | 2026-04-12T12:25:41.924753+00:00 | `e4a87c09-576e-4068-bb94-04a94fea60ce` |

### 186 — financial-versions

Key: `gemswellfinancialsing|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials_ING_151024 .pdf | PHILAE | funding | unknown | 10 | 231 | a578ed266853b1eb | 2026-04-12T12:35:53.916281+00:00 | `931e7fbb-6aa9-40ab-85ad-6379fd075314` |
| 2 | Gemswell Financials_ING_151024 .pdf | PHILAE | funding | working_paper | 70 | 206 | 3d7ef793744d07bd | 2026-04-12T12:36:13.278706+00:00 | `c7b286b1-583b-4c91-939a-4b3114efe629` |

### 187 — financial-versions

Key: `gemswellfinancialsing01|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Financials ING_241127_01.pdf | PHILAE | funding | unknown | 10 | 303 | c07514ea4ceb45a5 | 2026-04-12T12:30:15.520553+00:00 | `013d4bd3-5d97-499b-8c0a-d97b7e8485b2` |
| 2 | Gemswell Financials ING_241105_01.pdf | PHILAE | funding | unknown | 10 | 299 | a5a046bf46e32bff | 2026-04-12T12:28:50.47089+00:00 | `96617878-38c0-48aa-9c0c-f05a362892a4` |
| 3 | Gemswell Financials ING_241127_01.pdf | PHILAE | funding | unknown | 10 | 308 | 2b4c3cfdb7757138 | 2026-04-12T12:29:30.996902+00:00 | `d324f1f6-9ded-4446-93d0-905aba969d41` |
| 4 | Gemswell Financials ING_241105_01.pdf | PHILAE | funding | working_paper | 10 | 269 | d34fa7924b364d47 | 2026-04-12T12:27:16.886258+00:00 | `d4a9891f-fe9d-4490-b429-a0378514f4bc` |
| 5 | Gemswell Financials ING_241129_01.pdf | PHILAE | funding | working_paper | 10 | 282 | 0afc516bcc6e29e8 | 2026-04-12T12:30:19.854395+00:00 | `de725a99-c759-4870-9631-78ea030d8e22` |
| 6 | Gemswell Financials ING_241125_01.pdf | PHILAE | funding | unknown | 10 | 295 | ef85c48e01771099 | 2026-04-12T12:29:35.087755+00:00 | `e6a30be6-e960-43ef-9f2d-9c80589ec9c3` |
| 7 | Gemswell Financials ING_241125_01.pdf | PHILAE | funding | unknown | 10 | 300 | 625f79e48dc75f2e | 2026-04-12T12:28:56.771758+00:00 | `f7fb4241-235d-472a-b996-71942461c849` |

### 188 — financial-versions

Key: `gemswellfoundingmemberscast|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Founding_Members_CAST_240609.pdf | PHILAE | funding | executed | 10 | 20 | d2e3c116433a0925 | 2026-04-12T12:07:51.295206+00:00 | `453d0778-9548-4329-b6f2-434530be35b3` |
| 2 | Gemswell_Founding_Members_CAST.pdf | PHILAE | legal | executed | 40 | 10 | 7d9d0e0a3efb1e0c | 2026-04-12T12:45:15.937804+00:00 | `56cf7964-f5ce-46f3-8650-57091bd85a7d` |
| 3 | Gemswell_Founding_Members_CAST_240531.pdf | PHILAE | funding | executed | 10 | 20 | dc23cc8ccaae410b | 2026-04-12T12:07:47.013753+00:00 | `66f1eac2-5869-4cd4-9043-dc6d5e40474b` |
| 4 | Gemswell_Founding_Members_CAST.pdf | PHILAE | funding | unknown | 10 | 20 | 1067f6a251706b36 | 2026-04-12T12:45:00.597738+00:00 | `7200092e-447e-4945-a406-9416ad3f8483` |
| 5 | Gemswell_Founding_Members_240522_CAST.pdf | PHILAE | funding | executed | 10 | 21 | f1ab671d864c51ee | 2026-04-12T12:07:17.016646+00:00 | `aa740fe2-8787-4318-a89f-060e75e4747a` |
| 6 | Gemswell_Founding_Members_CAST_240531.pdf | PHILAE | funding | executed | 10 | 10 | 8edb0fa8c4a18302 | 2026-04-12T12:08:13.644612+00:00 | `af58f7c1-5bdb-4924-9713-8ae08ce51b73` |
| 7 | Gemswell_Founding_Members_CAST_240613.pdf | PHILAE | funding | executed | 10 | 20 | 244b6ba2a398ee08 | 2026-04-12T12:07:54.297316+00:00 | `cceb4774-fe6c-430e-9a9c-0c71cf848993` |

### 189 — financial-versions

Key: `gemswellfoundingmemberseng|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Founding_Members_ENG.pdf | PHILAE | funding | executed | 10 | 85 | b6d78dd52f3fb86e | 2026-04-12T12:45:39.863824+00:00 | `33e4e120-530d-4c83-9116-91096599ac41` |
| 2 | Gemswell_Founding_Members_ENG.pdf | PHILAE | general | unknown | 10 | 70 | 6374e0498343e33a | 2026-04-12T12:45:03.889265+00:00 | `6fd7d7d9-938c-4c7c-bb92-f1fd06cb6ddc` |
| 3 | Gemswell_Founding_Members_ENG_240531.pdf | PHILAE | funding | executed | 10 | 87 | b2889bcf617f0109 | 2026-04-12T12:09:44.019403+00:00 | `73c1ddf5-088a-481a-bfea-f167d38a597a` |
| 4 | Gemswell_Founding_Members_ENG_240531.pdf | PHILAE | funding | executed | 10 | 77 | c14fe1a89e5da266 | 2026-04-12T12:08:12.945143+00:00 | `e46f99a2-3149-44fa-9945-c5689edcb3a7` |

### 190 — financial-versions

Key: `gemswellfoundingmemberseng11|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Founding_Members_ENG_241015_11.pdf | PHILAE | general | unknown | 10 | 71 | ed74d5be0fb55c17 | 2026-04-12T12:09:09.589414+00:00 | `7c9ff330-5324-44c6-b250-79bf294ad549` |
| 2 | Gemswell_Founding_Members_ENG_241015_11.pdf | PHILAE | funding | executed | 10 | 86 | 5d5036455d3ec23d | 2026-04-12T12:10:52.736588+00:00 | `d8d4e399-24dd-498b-820e-0969aa8b8b53` |

### 191 — financial-versions

Key: `gemswellfoundingmemberseng13|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Founding_Members_ENG_13.pdf | PHILAE | funding | unknown | 10 | 71 | e35aa6c2bdea16c3 | 2026-04-12T12:09:01.858937+00:00 | `67995b53-367d-489d-920a-cb70539ed591` |
| 2 | Gemswell_Founding_Members_ENG_13.pdf | PHILAE | funding | unknown | 10 | 86 | c9a0255a50be8fda | 2026-04-12T12:08:02.454141+00:00 | `d4891147-7f47-4a1f-8ecb-e9873e4d0a00` |

### 192 — financial-versions

Key: `gemswellfoundingmembersengbenefits|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Founding_Members_ENG_240609benefits.pdf | PHILAE | general | executed | 10 | 72 | 3dbeef52cbdc0502 | 2026-04-12T12:10:06.992181+00:00 | `41489a7f-5185-4081-95c2-1eab5effc67d` |
| 2 | Gemswell_Founding_Members_ENG_240609benefits.pdf | PHILAE | funding | executed | 10 | 87 | 9c0d6a9db2859f24 | 2026-04-12T12:08:53.844817+00:00 | `ab66afe3-111b-4110-b98f-b680f2b449b2` |

### 193 — financial-versions

Key: `gemswelljdcfo|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_ CFO.docx | GVF | bp_model | unknown | 85 | 2 | 0b41dc155c83c848 | 2026-04-12T12:07:45.221515+00:00 | `3af27d9c-c46d-4bd8-9ac5-e3991606f079` |
| 2 | Gemswell_JD_ CFO.pdf | GVF | bp_model | unknown | 85 | 2 | 7d84157ce0a2bdf7 | 2026-04-12T12:07:47.069896+00:00 | `5a7fa208-e1eb-47a7-96c6-e782e4a9edda` |

### 194 — financial-versions

Key: `gemswelljdcmo|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_CMO.pdf | GVF | bp_model | unknown | 85 | 5 | 966d9fdb4b3f3f1d | 2026-04-12T12:07:52.481493+00:00 | `01bc0b3f-6915-427b-8921-8b93b63494f8` |
| 2 | Gemswell_JD_CMO.docx | GVF | bp_model | unknown | 85 | 4 | 262f16646f19ff58 | 2026-04-12T12:07:51.109481+00:00 | `fe142cd2-6673-4a50-9056-8038ca043e85` |

### 195 — financial-versions

Key: `gemswelljdcoo|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_ COO.pdf | GVF | bp_model | unknown | 85 | 3 | 6a46fd5b52197503 | 2026-04-12T12:07:49.750078+00:00 | `0bff2ed9-1a27-4b85-86bd-1aa08ed5eb88` |
| 2 | Gemswell_JD_ COO.docx | GVF | bp_model | unknown | 85 | 2 | 10b2200da133fa39 | 2026-04-12T12:07:48.456433+00:00 | `fbacbca8-4065-4909-8e5d-0d327d7885a6` |

### 196 — financial-versions

Key: `gemswelljdgeneralmanager|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_General Manager.pdf | GVF | bp_model | unknown | 85 | 4 | df76c2f0ad35373d | 2026-04-12T12:07:55.57451+00:00 | `8455666a-5544-4355-87ea-a04092223114` |
| 2 | Gemswell_JD_General Manager.docx | GVF | bp_model | unknown | 85 | 3 | e6ddcf2b38b8ee35 | 2026-04-12T12:07:54.258055+00:00 | `cc2e6499-1a3a-472f-8a23-9d552a22e4fd` |

### 197 — financial-versions

Key: `gemswelljdhrdirector|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_HR Director.pdf | GVF | bp_model | unknown | 85 | 3 | 1a7b0b7e1134be4c | 2026-04-12T12:07:58.809412+00:00 | `566627ee-0c4f-41c1-99ca-3d3c977342f7` |
| 2 | Gemswell_JD_HR Director.docx | GVF | bp_model | unknown | 85 | 3 | 38f2769465ef5242 | 2026-04-12T12:07:57.081097+00:00 | `fb803cd7-3a26-450a-bb22-b2d14fee64b4` |

### 198 — financial-versions

Key: `gemswelljdinparkrevenuedirector|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_In-Park Revenue Director.docx | GVF | bp_model | unknown | 85 | 3 | 87a8ac4d63ac64ec | 2026-04-12T12:08:00.419435+00:00 | `11ea3be5-1c5b-485f-bb91-aee5357a913f` |
| 2 | Gemswell_JD_In-Park Revenue Director.pdf | GVF | bp_model | unknown | 85 | 4 | c063da4336acb69b | 2026-04-12T12:08:01.758225+00:00 | `db944c18-7e1f-4300-99a2-be1266fe6940` |

### 199 — financial-versions

Key: `gemswelljdseniordevelopmentassetmanager|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_JD_Senior Development & Asset Manager.pdf | GVF | bp_model | unknown | 85 | 3 | 918fef20c34c9636 | 2026-04-12T12:08:04.759179+00:00 | `1f86fd84-74ab-4085-a751-f6b949d5f7c9` |
| 2 | Gemswell_JD_Senior Development & Asset Manager.docx | GVF | bp_model | unknown | 85 | 4 | 6a3d96e76a0ef5ce | 2026-04-12T12:08:03.288873+00:00 | `368c8d22-109f-4cc0-bc61-78cd92f2494f` |

### 200 — financial-versions

Key: `gemswellmadridmodel|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | GemSwell Madrid Model.xlsx | GVF | bp_model | working_paper | 40 | 36 | 714edbc1c92137a1 | 2026-04-12T12:52:24.372876+00:00 | `6ca76c64-fd2d-47f2-84bd-c7adb34908fc` |
| 2 | GemSwell Madrid Model.xlsx | GVF | bp_model | working_paper | 40 | 36 | 653aa30854c8ccf7 | 2026-04-12T12:52:25.152623+00:00 | `cf5f667d-b051-4263-8980-61cebb3ae44b` |

### 201 — financial-versions

Key: `gemswellprojectteasercast06|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Project_Teaser_CAST_06_240829.pdf | PHILAE | funding | unknown | 10 | 24 | 7ff4b703d1f7af03 | 2026-04-12T12:11:25.32022+00:00 | `e379c675-151d-4aaa-81ff-e2dcf89d74e1` |
| 2 | Gemswell_Project_Teaser_CAST_06_240829.pdf | PHILAE | general | unknown | 10 | 14 | 0607cbbd6b705c3c | 2026-04-12T12:10:07.440562+00:00 | `f25d5cb3-5bce-4482-9f3b-62c8e999db90` |

### 202 — financial-versions

Key: `gemswellprojectteasereng06gv|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell_Project_Teaser_ENG_06_240910 GV.pdf | PHILAE | funding | draft | 10 | 10 | c3b55ee3ec5f4c4a | 2026-04-12T12:43:00.589924+00:00 | `7ef60d5c-6454-4230-a0e9-372003338a09` |
| 2 | Gemswell_Project_Teaser_ENG_06_240910 GV.pdf | PHILAE | funding | draft | 10 | 30 | 47eee7042beb3707 | 2026-04-12T12:42:53.48052+00:00 | `825b1d66-a044-4852-99af-366e5b6de771` |

### 203 — financial-versions

Key: `generalarrangementmerged|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | GeneralArrangement_merged.pdf | BHX | capex | draft | 40 | 815 | 8b6039550150f27e | 2026-04-12T09:54:38.339851+00:00 | `347ba021-73d9-4e72-bfe4-1ec2ebb4a95a` |
| 2 | GeneralArrangement_merged.pdf | BHX | capex | draft | 40 | 1282 | e2ce78354cefbe83 | 2026-04-12T09:55:27.596961+00:00 | `c33d3785-b1f4-44c2-9e26-ebfa784c1661` |

### 204 — financial-versions

Key: `generaldnaconurma|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241211 - GENERAL DNA CONURMA.pdf | MAD | monitoring | unknown | 85 | 1934 | 666f51c262aeaacd | 2026-04-12T14:16:40.337482+00:00 | `3eb45192-3081-4dcf-a4ac-6176abb431db` |
| 2 | 20241227 - GENERAL DNA CONURMA.xlsx | MAD | monitoring | unknown | 85 | 593 | ee83772020d84f70 | 2026-04-12T11:56:43.782339+00:00 | `c92dadb7-fe1b-4444-abbc-09fb3b1cd95e` |
| 3 | 20241227 - GENERAL DNA CONURMA.pdf | MAD | monitoring | unknown | 85 | 1944 | 09241f21646d1006 | 2026-04-12T14:23:34.054188+00:00 | `cca8b07b-301b-4eae-b188-4ffcb2b7b663` |
| 4 | 20241211 - GENERAL DNA CONURMA.xlsx | MAD | monitoring | unknown | 85 | 592 | 28a52c5d47b160fa | 2026-04-12T11:52:33.585919+00:00 | `e31c082a-9c33-417b-9561-f6c6ee43d813` |

### 205 — financial-versions

Key: `jdcontrollerfinancieroerpconrecomendacionesintegradas|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | JD_Controller_financiero_ERP_con_recomendaciones_integradas - V2.docx | GVF | bp_model | unknown | 85 | 4 | 01b5eca301c77f12 | 2026-04-12T12:08:06.215092+00:00 | `a69fa3ef-80da-4606-bdd4-39c07e560bdf` |
| 2 | JD_Controller_financiero_ERP_con_recomendaciones_integradas - V2.pdf | GVF | bp_model | unknown | 85 | 4 | b7cb819e120fce52 | 2026-04-12T12:08:08.46446+00:00 | `c98569c3-0c0d-4d91-af2a-d9d0bf43d0bb` |

### 206 — financial-versions

Key: `juntaactaaprobaciondeccaa|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Junta 20.6.25 ACTA. Aprobación de CCAA .pdf | MAD | financial_statements | unknown | 90 | 7 | 9151dec3e6fbdc07 | 2026-04-12T12:14:05.285495+00:00 | `2b08d50a-da95-497c-aba3-7bccab767af5` |
| 2 | Junta 20.6.25 ACTA. Aprobación de CCAA (firmada).pdf | MAD | board | signed | 90 | 2 | fc056df3110fd2f1 | 2026-04-12T12:32:29.065742+00:00 | `3d66cc98-0f3b-417f-9e93-27923d02b513` |

### 207 — financial-versions

Key: `juntaactaaprobaciondeccaaycambiodeconsejero|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Junta 28.6.24 ACTA. Aprobación de CCAA y cambio de consejero .pdf | MAD | financial_statements | unknown | 90 | 8 | e66db9a840f06c0a | 2026-04-12T12:10:01.712817+00:00 | `447ba8c2-3e26-4b4b-acd8-be1b8ff81daa` |
| 2 | Junta_28.6.24_ACTA._Aprobación_de_CCAA_y_cambio_de_consejero_.pdf | MAD | financial_statements | unknown | 90 | 8 | e7c94845f40c8212 | 2026-04-12T12:09:45.536056+00:00 | `5abe718c-a49f-43b9-a05a-8172ccaa11e5` |

### 208 — financial-versions

Key: `lauromembersbp|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | LAURO MEMBERS BP.xlsx | GVF | bp_model | working_paper | 40 | 2 | 68598c18e14448c4 | 2026-04-12T12:41:49.630606+00:00 | `0cf4e129-926e-47cb-9848-bc5427c3cec6` |
| 2 | LAURO MEMBERS BP .xlsx | GVF | bp_model | working_paper | 40 | 2 | 333fffbbbbb22e63 | 2026-04-12T12:41:48.372704+00:00 | `76bd3e53-5d22-4ad6-b2d5-9f2f23e5d58b` |

### 209 — financial-versions

Key: `laurowaves|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Lauro_Waves.xlsx | GVF | bp_model | working_paper | 40 | 29 | 60c85cf5993a4efd | 2026-04-12T12:41:51.712264+00:00 | `2362c8ab-5793-490f-ac45-339b5e39b329` |
| 2 | Lauro_Waves.xlsx | GVF | bp_model | working_paper | 40 | 4 | 374816c6db59a3f7 | 2026-04-12T12:42:57.649152+00:00 | `49d61aa4-9bf4-4499-827c-e1ad7180da65` |

### 210 — financial-versions

Key: `laurowavesescenario2000|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Lauro_Waves_Escenario_2,000.xlsx | GVF | bp_model | working_paper | 40 | 5 | e2288f176c9743af | 2026-04-12T12:42:01.120751+00:00 | `c0dbb810-f1b1-4651-848e-b4831fd6b263` |
| 2 | Lauro_Waves_Escenario_2,000.xlsx | GVF | bp_model | working_paper | 40 | 12 | 56cbef9e8f07fffb | 2026-04-12T12:43:43.434921+00:00 | `eea78186-4e14-44d8-b3d8-5bb192409140` |

### 211 — financial-versions

Key: `laurowavesescenario900|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Lauro_Waves_Escenario_900.xlsx | GVF | capex | working_paper | 40 | 2 | 33f5dab549027af7 | 2026-04-12T12:42:24.336537+00:00 | `4786964f-b7e7-4cc2-9eec-69ffb51cede3` |
| 2 | Lauro_Waves_Escenario_900.xlsx | GVF | bp_model | working_paper | 40 | 12 | 55d8127c4a83e521 | 2026-04-12T12:43:45.983644+00:00 | `b0c02cdd-66eb-4f8b-a4b0-57cbffccba17` |

### 212 — financial-versions

Key: `listadocambios|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 241211-LISTADO CAMBIOS.xlsx | MAD | monitoring | unknown | 85 | 14 | be6a1ba12ff723aa | 2026-04-12T11:52:29.677389+00:00 | `edaf426e-5806-4817-862f-b9690d9bfb82` |
| 2 | 241211-LISTADO CAMBIOS.pdf | MAD | monitoring | unknown | 85 | 14 | 8d09245a36aeda21 | 2026-04-12T14:16:36.960271+00:00 | `f7b79b40-3de6-4611-b574-60305f012684` |

### 213 — financial-versions

Key: `loanagreementvsoreiiiwaveparkholdingswarwickshireltd|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Loan Agreement_VSORE III_ Wave Park Holdings (Warwickshire LTD.docx | BHX | legal | signed | 90 | 31 | 7793a7fca91a4759 | 2026-04-11T18:00:34.446467+00:00 | `43367f33-1f01-479e-b342-502f50104702` |
| 2 | Loan Agreement_VSORE III_ Wave Park Holdings (Warwickshire LTD.docx | BHX | funding | signed | 90 | 32 | c1f6d3bc8342d3d8 | 2026-04-11T17:54:31.005524+00:00 | `57404e39-c362-4f2d-80dc-9941c3a79473` |

### 214 — financial-versions

Key: `madpsarcrevisiondetemaspendientes|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MAD-PS-ARC- Revision de temas pendientes 20240524.pdf | GVF | monitoring | unknown | 75 | 133 | dc93c68a5abef1d6 | 2026-04-12T12:44:55.226861+00:00 | `1eee77a0-3faa-4b29-9728-f782577dcbdb` |
| 2 | MAD-PS-ARC- Revision de temas pendientes 20240524.pdf | GVF | monitoring | unknown | 75 | 145 | 62a7d6206e41a056 | 2026-04-12T12:45:46.588255+00:00 | `2806d740-779e-4275-8774-97ea40b09b32` |
| 3 | MAD-PS-ARC- Revision de temas pendientes 20240612 (2).pdf | GVF | monitoring | unknown | 75 | 1 | dc4344fa92ca1b33 | 2026-04-12T12:45:40.14728+00:00 | `7cde8dc6-663b-40a4-b5cc-85473fe2789e` |
| 4 | MAD-PS-ARC- Revision de temas pendientes 20240627.pdf | GVF | monitoring | unknown | 75 | 9 | 195f887f38aeb906 | 2026-04-12T12:46:26.634064+00:00 | `d84e17a4-45e5-4f62-ad68-45da09787843` |
| 5 | MAD-PS-ARC- Revision de temas pendientes 20240627.pdf | GVF | monitoring | unknown | 75 | 14 | 0fcb1acb92d224ee | 2026-04-12T12:45:41.970935+00:00 | `e216451d-3204-45d2-8a85-d9bcf4cb3385` |

### 215 — financial-versions

Key: `madridplayasurfslmemoriaabreviada2024|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MADRID PLAYA SURF SL - MEMORIA Abreviada 2024.pdf | MAD | financial_statements | unknown | 90 | 53 | 9b5b5b113b708c51 | 2026-04-12T12:13:52.719896+00:00 | `42583519-1edb-4840-92e1-6201d82b618b` |
| 2 | MADRID PLAYA SURF SL - MEMORIA Abreviada 2024.docx | MAD | financial_statements | unknown | 90 | 115 | 2451aea892abee42 | 2026-04-12T12:13:37.9911+00:00 | `58602418-2cd7-4ed8-9686-52fa6e80b185` |
| 3 | MADRID PLAYA SURF SL - MEMORIA Abreviada 2024 (firmado).pdf | MAD | board | signed | 90 | 60 | 94ffb38054d4aa29 | 2026-04-12T12:33:50.50178+00:00 | `ce332d27-c065-47aa-91bb-4f356d7614a4` |

### 216 — financial-versions

Key: `mediciones01societyclubgymgs|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MEDICIONES_01_SOCIETY CLUB(GYM)_GS.pdf | MAD | monitoring | unknown | 85 | 23 | f58e4bd5a709e116 | 2026-04-12T13:54:57.066316+00:00 | `1265db9e-1305-4ac7-97f0-74aaac5ebc45` |
| 2 | MEDICIONES_01_SOCIETY CLUB(GYM)_GS.xlsx | MAD | monitoring | unknown | 85 | 8 | 2f95b18eb00ec7a0 | 2026-04-12T11:44:51.324665+00:00 | `dbb4aa6e-055a-438f-908e-56ff2d24c5d4` |

### 217 — financial-versions

Key: `mediciones01societyclubloungegs|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MEDICIONES_01_SOCIETY CLUB (LOUNGE)_GS.xlsx | MAD | monitoring | unknown | 85 | 9 | 93b3fabeff179ad9 | 2026-04-12T11:45:17.447639+00:00 | `1f8c31a2-14a0-420f-832f-b80993cbddac` |
| 2 | MEDICIONES_01_SOCIETY CLUB (LOUNGE)_GS.pdf | MAD | monitoring | unknown | 85 | 30 | df49c32dd10f6125 | 2026-04-12T13:56:00.306945+00:00 | `cd06bc3b-8816-4ae7-b35e-292f48121744` |

### 218 — financial-versions

Key: `mediciones01societyclubvestuarioscabinasgs|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MEDICIONES_01_SOCIETY CLUB (VESTUARIOS+CABINAS)_GS.pdf | MAD | monitoring | unknown | 85 | 40 | 7fddb10f9fa30f04 | 2026-04-12T13:57:33.485478+00:00 | `44cabfbb-59d5-47f3-b6ca-0596d7e9cf1c` |
| 2 | MEDICIONES_01_SOCIETY CLUB (VESTUARIOS+CABINAS)_GS.xlsx | MAD | monitoring | unknown | 85 | 12 | 27019ba11fe78c66 | 2026-04-12T11:45:52.211795+00:00 | `688e6561-b1b7-487d-aec4-0327d456462a` |

### 219 — financial-versions

Key: `membershipplandescription|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MEMBERSHIP PLAN DESCRIPTION.pdf | PHILAE | general | unknown | 40 | 13 | 881748331ecf3622 | 2026-04-12T12:37:32.620568+00:00 | `19904d0a-30e6-4dfc-874a-6614d419b064` |
| 2 | MEMBERSHIP PLAN DESCRIPTION.pdf | PHILAE | funding | working_paper | 10 | 18 | 14144a9de0797457 | 2026-04-12T12:37:53.778007+00:00 | `8f2ef8e4-725b-4aec-a307-29d2a3f30dba` |

### 220 — financial-versions

Key: `memophase2birmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240301_Memo Phase 2_Birmingham v2.docx | BHX | funding | draft | 60 | 27 | 9490626b199955a6 | 2026-04-11T17:41:58.335263+00:00 | `08058ab9-a230-4f1c-abb1-59a883ecac44` |
| 2 | 20240301_Memo Phase 2_Birmingham v2.docx | BHX | funding | draft | 60 | 27 | f7b64e8455914af0 | 2026-04-11T17:32:22.038462+00:00 | `3d0472c6-513d-4697-94dc-e6d8faa21c5b` |
| 3 | 20240301_Memo Phase 2_Birmingham v2.docx | BHX | funding | draft | 60 | 27 | 55926030873524c3 | 2026-04-11T17:35:21.75403+00:00 | `55ffd99c-c976-49f4-a785-a8ec9345db3c` |
| 4 | 20240304_Memo Phase 2_Birmingham.docx | BHX | funding | draft | 60 | 26 | d3f17b92f071dab2 | 2026-04-11T17:34:10.630078+00:00 | `c4662ac5-3f4f-47e9-9dd5-2d8486733c41` |

### 221 — financial-versions

Key: `memophase3birmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240419_Memo Phase 3_Birmingham.pdf | BHX | funding | working_paper | 60 | 45 | 6a3aaae1465f9763 | 2026-04-11T17:38:06.385862+00:00 | `7e0ea489-974d-413d-9562-d6b73ebb09cf` |
| 2 | 20240419_Memo Phase 3_Birmingham.docx | BHX | funding | working_paper | 60 | 40 | dd86a20c540cf6fb | 2026-04-11T17:37:32.725987+00:00 | `cdf6ea99-3956-4a84-82f0-faedef3610dc` |
| 3 | 20240419_Memo Phase 3_Birmingham.docx | BHX | funding | working_paper | 60 | 40 | cb20c9887dd62dbb | 2026-04-11T17:42:45.959235+00:00 | `f8687c83-6754-4161-a7b3-ea51c0d13da6` |

### 222 — financial-versions

Key: `memophase3birminghamnoejecutadaenfecha|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240313_Memo Phase 3_Birmingham_No Ejecutada en Fecha.docx | BHX | funding | draft | 60 | 42 | 2aa2e8e7d117c714 | 2026-04-11T17:39:32.134283+00:00 | `cf949196-87cb-47a0-b46c-e140e82ff7bb` |
| 2 | 20240313_Memo Phase 3_Birmingham_No Ejecutada en Fecha.docx | BHX | funding | draft | 60 | 43 | 2838d43c0279170f | 2026-04-11T17:36:42.935931+00:00 | `ea87bd1a-cd20-44d8-84df-2c64f366c19f` |

### 223 — financial-versions

Key: `memophase3birminghamupdated|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240430_Memo Phase 3_Birmingham - UPDATED.docx | BHX | funding | working_paper | 60 | 40 | 4d66cfe08c997fbb | 2026-04-11T17:44:49.807556+00:00 | `093570e5-d361-47ab-97aa-1422d8f64e03` |
| 2 | 20240430_Memo Phase 3_Birmingham - UPDATED v2.docx | BHX | funding | draft | 60 | 44 | 7676b1aac12ded6f | 2026-04-11T17:08:34.720756+00:00 | `9f0a08a4-c9ee-4b43-921d-b67562bbd1ce` |
| 3 | 20240430_Memo Phase 3_Birmingham - UPDATED v2.pdf | BHX | funding | working_paper | 60 | 44 | 5859ec706b866caa | 2026-04-11T17:09:09.024847+00:00 | `b213d6b9-dcda-40b8-a999-a0c6dc5cd8e3` |

### 224 — financial-versions

Key: `memophase5birmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241107_Memo Phase 5_Birmingham.docx | BHX | funding | working_paper | 60 | 71 | b81c8c319d1acd41 | 2026-04-11T17:43:51.532302+00:00 | `3f9dda6c-d656-45b4-a6ef-65fada19cade` |
| 2 | 20241107_Memo Phase 5_Birmingham.docx | BHX | funding | working_paper | 60 | 71 | 9b6c43e5e0ff230c | 2026-04-11T17:41:22.036622+00:00 | `c73c5f95-39a1-4a64-8a5f-82c9c18223d8` |

### 225 — financial-versions

Key: `memophase7birmingham|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250808_Memo Phase 7_Birmingham.docx | BHX | funding | working_paper | 60 | 122 | 094d28b796f4a071 | 2026-04-11T17:59:50.432126+00:00 | `0a99b624-48d9-487c-8d1f-41b03902bf06` |
| 2 | 20250808_Memo Phase 7_Birmingham.docx | BHX | dd | working_paper | 60 | 124 | 1f5ffa7e38f914de | 2026-04-11T17:50:52.965799+00:00 | `de42e61e-8424-4869-8123-0630b11088c1` |

### 226 — financial-versions

Key: `mod3472023madridplaya|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MOD 347 2023_MADRID PLAYA V2.pdf | MAD | financial_statements | unknown | 90 | 20 | 3fb9b2a1fe787662 | 2026-04-12T12:11:11.034712+00:00 | `03dc9250-a001-41bd-8c3a-d3250566b4b8` |
| 2 | MOD 347 2023_MADRID PLAYA.pdf | MAD | financial_statements | unknown | 90 | 16 | d75b3ccee45b839d | 2026-04-12T12:11:14.140311+00:00 | `d645f92d-9f09-4d09-880c-4809c203a7f3` |

### 227 — financial-versions

Key: `mpscierre3t2025|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MPSCIERRE3T-2025.xlsx | MAD | financial_statements | unknown | 90 | 127 | 531797ece8740175 | 2026-04-12T11:35:17.690803+00:00 | `0893a562-a011-4cd2-8563-6f5988541044` |
| 2 | MPSCIERRE3T-2025 V1.xlsx | MAD | financial_statements | unknown | 90 | 133 | 5437bfb3ee8c974d | 2026-04-12T11:35:01.750994+00:00 | `8b42f499-786e-4cc4-b1d9-fa9848629c6c` |

### 228 — financial-versions

Key: `mpscostallocationaprobadomayo25|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250521 MPS Cost Allocation Aprobado mayo 25.xlsx | MAD | monitoring | unknown | 85 | 23 | c3bcb8a0cc30a266 | 2026-04-12T11:44:07.865723+00:00 | `d2fe51f9-ba1a-4f7a-bb6f-592299634d4e` |
| 2 | 20250519 MPS Cost Allocation Aprobado mayo 25.xlsx | MAD | monitoring | unknown | 85 | 23 | 685676b7797d49e6 | 2026-04-12T11:44:03.999788+00:00 | `d7bd511c-949c-46df-a7a7-dd8e8526908f` |

### 229 — financial-versions

Key: `mpspropuestareduccioncostesmps|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250115 MPS.Propuesta reducción costes. rev5 (MPS).xlsx | MAD | monitoring | unknown | 85 | 21 | e293cc2850023b1a | 2026-04-12T11:43:11.788124+00:00 | `58754573-9a6e-41c4-8563-c4267e32cb21` |
| 2 | 20250115 MPS.Propuesta reducción costes. rev5 (MPS) 20250121.xlsx | MAD | monitoring | unknown | 85 | 23 | 7d33c3f0de310283 | 2026-04-12T11:43:04.271255+00:00 | `ee0153e4-01e2-4480-8c83-8dbb27d8e901` |

### 230 — financial-versions

Key: `mpsrevisioncostallocation|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MPS. Revisión Cost allocation rev2.xlsx | MAD | monitoring | unknown | 85 | 12 | 500a97211869cb6b | 2026-04-12T11:43:26.410939+00:00 | `094cf169-8f19-4f81-90ee-b07151e458ca` |
| 2 | MPS. Revisión Cost allocation rev1.xlsx | MAD | monitoring | unknown | 85 | 10 | 7da0e428a5ee49da | 2026-04-12T11:43:47.731943+00:00 | `65c0af42-9049-46a0-9808-ba7e6f41910e` |

### 231 — financial-versions

Key: `ndampsunilateralgenericoesp|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | NDA MPS (unilateral) genérico ESP firmado.pdf | MAD | monitoring | unknown | 90 | 17 | ecd65a704cdfbfbd | 2026-04-12T13:52:38.856263+00:00 | `7be7e137-e508-4994-b2b6-7b27e6759a9b` |
| 2 | NDA MPS (unilateral) genérico ESP.pdf | MAD | monitoring | unknown | 90 | 18 | 2715ecf40266390d | 2026-04-12T13:51:35.456494+00:00 | `e3030618-714b-4149-ad34-c9386c25f29f` |

### 232 — financial-versions

Key: `nominalledgeraprtojun25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Nominal Ledger - Apr to Jun 25.xlsx | BHX | financial_statements | working_paper | 40 | 3 | a0dcbab076b5b906 | 2026-04-11T16:59:20.992876+00:00 | `29efa69c-83c9-4870-9e36-ca175b201448` |
| 2 | Nominal Ledger - Apr to Jun 25.xlsx | BHX | financial_statements | working_paper | 40 | 4 | a4c830a359a22715 | 2026-06-04T18:01:16.478285+00:00 | `d0cae3ff-7684-4047-a54c-ced8ff9648b4` |

### 233 — financial-versions

Key: `ordendeldia1reunionquincenalgemswellsurfmadrid|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240906_Orden del día 1ª Reunión Quincenal_Gemswell Surf Madrid.pdf | MAD | monitoring | unknown | 80 | 2 | 1056b54fcf286e50 | 2026-04-12T13:38:37.081077+00:00 | `7c99f927-e359-4129-9ab4-4c0da2cd0138` |
| 2 | 20240906_Orden del día 1ª Reunión Quincenal_Gemswell Surf Madrid.docx | MAD | monitoring | unknown | 80 | 1 | bd89ee2f1667e065 | 2026-04-12T13:38:35.842024+00:00 | `9f5d36db-ae65-4348-8832-032577a250ab` |

### 234 — financial-versions

Key: `ordendeldia2reunionquincenalgemswellsurfmadrid|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241004_Orden del día 2ª Reunión Quincenal_Gemswell Surf Madrid.pdf | MAD | monitoring | unknown | 80 | 5 | bb1ae000db017441 | 2026-04-12T13:38:45.917689+00:00 | `15c9746d-4efc-47af-9f1f-d37f86480a14` |
| 2 | 20241004_Orden del día 2ª Reunión Quincenal_Gemswell Surf Madrid.docx | MAD | monitoring | unknown | 80 | 4 | 11c176be275150d5 | 2026-04-12T13:38:38.360146+00:00 | `cd2bbb22-1760-4eb6-939a-e82f4ddd7c42` |

### 235 — financial-versions

Key: `paymentorder|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Signed Payment Order 270326.pdf | BHX | cash_flow | signed | 90 | 2 | 626d033e95b02384 | 2026-04-11T18:57:07.927324+00:00 | `2eefe8d1-56ce-447c-8781-beacf6dc988f` |
| 2 | Signed Payment Order .pdf | BHX | cash_flow | signed | 90 | 3 | a14147ea316b276a | 2026-04-11T18:56:48.957774+00:00 | `e5df5e52-e28f-4581-87de-2e87b612eca6` |
| 3 | Signed Payment Order.pdf | BHX | cash_flow | signed | 90 | 1 | d6bd8d0ad3e58fca | 2026-04-11T18:59:32.809265+00:00 | `fdf8df8b-7f25-4b80-b578-812187327994` |

### 236 — financial-versions

Key: `paymentorders|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Signed Payment Orders 200525 .pdf | BHX | cash_flow | signed | 90 | 3 | 5347a572f8b90680 | 2026-04-11T18:58:25.823693+00:00 | `9b7e8f44-08ac-4e7b-90a0-63a67a0f027a` |
| 2 | Signed Payment Orders .pdf | BHX | cash_flow | signed | 90 | 3 | 79ecf757451bdbd8 | 2026-04-11T18:58:01.065875+00:00 | `f9f8a3d1-8e48-4700-9ffa-37b1aaca959a` |

### 237 — financial-versions

Key: `ragemswellr09|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | RA_GEMSWELL_R09.pdf | GVF | monitoring | executed | 40 | 210 | 59be69d6d5a84e88 | 2026-04-12T12:49:33.088754+00:00 | `1db7db57-2b60-4d9f-9dcb-80feffe767bf` |
| 2 | RA_GEMSWELL_R09.pdf | GVF | monitoring | executed | 40 | 205 | 14ca0aabd7b7151d | 2026-04-12T12:49:20.832792+00:00 | `264d2118-f237-4e64-97a8-21bcc56bc913` |

### 238 — financial-versions

Key: `spgeneraldnaconurma|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227 - SP - GENERAL DNA CONURMA.pdf | MAD | monitoring | unknown | 85 | 1829 | c9e67fc9c9e15020 | 2026-04-12T14:26:11.875351+00:00 | `7093514c-807d-41cb-a6aa-98b97ca7383c` |
| 2 | 20241211 - SP - GENERAL DNA CONURMA.pdf | MAD | monitoring | unknown | 85 | 1820 | c835273f9e4a5dae | 2026-04-12T14:19:18.90385+00:00 | `8b579651-8c72-4ed7-ab3a-7e6d17604df3` |
| 3 | 20241227 - SP - GENERAL DNA CONURMA.xlsx | MAD | monitoring | unknown | 85 | 585 | dca5de5ccb73f09c | 2026-04-12T11:57:48.194396+00:00 | `a943ef38-ded3-4020-ad11-7a23b7e62669` |
| 4 | 20241211 - SP - GENERAL DNA CONURMA.xlsx | MAD | monitoring | unknown | 85 | 584 | a29b7891dc2f987a | 2026-04-12T11:54:51.80761+00:00 | `c5e36334-5d5c-44de-96fb-e6cc2048da14` |

### 239 — financial-versions

Key: `stoneweginfrasportsupdate|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Stoneweg Infrasports Update.pdf | PHILAE | monitoring | executed | 40 | 11 | 70b52a392ec99597 | 2026-04-12T12:44:45.611175+00:00 | `4eed502b-955b-467b-902d-59c3977942a1` |
| 2 | Stoneweg Infrasports Update.pdf | PHILAE | general | unknown | 10 | 1 | 92db011201df31b3 | 2026-04-12T12:44:21.877768+00:00 | `f1cd2066-d70a-40d1-aa45-5f5ad1b92180` |

### 240 — financial-versions

Key: `swsurfparkssv|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240319 SW Surf Parks SV.pdf | PHILAE | funding | unknown | 10 | 24 | f3488c573c448977 | 2026-04-12T12:14:50.58719+00:00 | `66fff44a-01cc-4955-b670-7dce9a13fb87` |
| 2 | 20240319 SW Surf Parks SV.pdf | PHILAE | bp_model | working_paper | 40 | 9 | 211ec9fcfd682045 | 2026-04-12T12:13:11.583704+00:00 | `9b03d729-fe63-4859-8cac-09b7bfe2a4c4` |

### 241 — financial-versions

Key: `swwaveparksjan2025vf|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | SW Wave Parks_Jan_2025_vF.pdf | PHILAE | funding | unknown | 10 | 105 | 24cc724032c6d71d | 2026-04-12T12:37:51.482832+00:00 | `888c32a1-3e8a-4c6a-b48e-eb2a72f6b3b9` |
| 2 | SW Wave Parks_Jan_2025_vF.pdf | PHILAE | funding | unknown | 10 | 93 | 5c38bfd026b0bcf6 | 2026-04-12T12:38:03.159109+00:00 | `d2f163a7-9a4b-4b88-83be-a4e5c439d3b8` |

### 242 — financial-versions

Key: `teasersvswpaneuropeanhospitality|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240827_TeaserSV_SW Pan-European Hospitality.pdf | PHILAE | funding | unknown | 10 | 81 | a99a8c545ea87372 | 2026-04-12T12:43:47.956009+00:00 | `0122159c-685b-4a09-a317-76e1fe1eb820` |
| 2 | 20240827_TeaserSV_SW Pan-European Hospitality.pdf | PHILAE | funding | unknown | 10 | 76 | dd2a122dd2053203 | 2026-04-12T12:43:23.96607+00:00 | `fc379849-04c3-4274-b650-bdbe2fb8681a` |

### 243 — financial-versions

Key: `traspasocuentasmembresiasmadridplayasurf|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250605_Traspaso cuentas Membresias_Madrid Playa Surf.pdf | MAD | financial_statements | unknown | 90 | 1 | 3c7866bd87d0b772 | 2026-04-12T12:18:46.445712+00:00 | `12e90925-f4d7-43d2-b6ea-31fb45862c25` |
| 2 | 20250605_Traspaso cuentas Membresias-Madrid Playa Surf.pdf | MAD | cash_flow | unknown | 85 | 1 | fac7fd27f73cbcf1 | 2026-04-12T11:06:57.360736+00:00 | `60fbd5ab-e13e-4f79-86fb-c66e81d7bda3` |

### 244 — financial-versions

Key: `ttr201edificiosurftrasdosadosplantabajorasante|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | TTR.2.01 - EDIFICIO SURF - TRASDOSADOS - PLANTA BAJO RASANTE-rev01.pdf | MAD | monitoring | unknown | 85 | 22 | 6a44b3242fc2571d | 2026-04-12T14:22:54.877161+00:00 | `06634d76-daa3-4ca1-80fb-cbe97ec5ac1a` |
| 2 | TTR2.01-EDIFICIO SURF - TRASDOSADOS - PLANTA BAJO RASANTE-rev1.pdf | MAD | monitoring | unknown | 85 | 22 | 9bc83231e68db4a1 | 2026-04-12T14:03:25.48785+00:00 | `bd264a2e-14b7-429b-99a9-8b714f2e97d1` |

### 245 — financial-versions

Key: `updatebirminghammodelv18|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Up-date Birmingham Model_v18.xlsx | BHX | bp_model | working_paper | 40 | 163 | 8059256bf2331e92 | 2026-04-11T16:34:49.344191+00:00 | `21cf827d-0cb3-4941-83fe-470a11f817da` |
| 2 | Up-date Birmingham Model_v18.xlsx | BHX | bp_model | working_paper | 40 | 168 | b5f2227cd7f22bfb | 2026-04-11T16:49:46.960785+00:00 | `db83ef0f-6c30-480a-93f9-a370a393c623` |

### 246 — financial-versions

Key: `variastructuredopportunitiesrealestateiiichart20certif|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Varia Structured Opportunities Real Estate III_Chart_20240620_Certif..pdf | PHILAE | funding | unknown | 0 | 11 | d04e332cc50766b8 | 2026-04-12T12:38:45.133024+00:00 | `3e64d7a8-9769-4f55-99b0-1ab93b8f5528` |
| 2 | Varia Structured Opportunities Real Estate III_Chart_20240620_Certif..pdf | PHILAE | funding | unknown | 0 | 10 | 34d034236b6177b2 | 2026-04-12T12:38:59.510901+00:00 | `c3cdc489-7eb3-4914-8467-7f21286e5c77` |

### 247 — financial-versions

Key: `wavegardensurfthemeparkdevelopmentredflagreportaugust2023|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Wavegarden Surf Theme Park Development- Red flag report- August 2023.pdf | BHX | dd | working_paper | 60 | 93 | a15f500e10d58af6 | 2026-04-11T20:09:01.372432+00:00 | `46bb7761-5442-4039-bd3e-da5ceaca86c1` |
| 2 | Wavegarden Surf Theme Park Development- Red flag report- August 2023.pdf | BHX | legal | draft | 0 | 138 | 74b87b244662ccc7 | 2026-04-11T18:48:14.584177+00:00 | `f4ae84d9-313c-4693-9569-59e44732188a` |

### 248 — financial-versions

Key: `wgspsarc0067r00lifeguardservices|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | WGS-PS-ARC-0067-R00-Lifeguard Services.pdf | GVF | monitoring | unknown | 75 | 14 | 5bda7850f9975cd0 | 2026-04-12T12:46:02.278473+00:00 | `1e87e4c6-197d-408c-ab6d-349a93c8d892` |
| 2 | WGS-PS-ARC-0067-R00-Lifeguard Services.pdf | GVF | monitoring | unknown | 75 | 20 | 7eb1eb9c45c8a53e | 2026-04-12T12:46:54.262174+00:00 | `62d500c8-ba41-4734-8878-86a2f5c0ae9e` |

### 249 — financial-versions

Key: `wgsurfopspeope0002r02dryingroomandwetsuitmanagement|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | WG Surf Ops 240222 PE-OPE-0002-R02_Drying room and wetsuit management.pdf | GVF | general | executed | 40 | 31 | bc57df682f70c84c | 2026-04-12T12:51:39.833929+00:00 | `25b90b49-df73-4291-8b98-ad061c001e94` |
| 2 | WG Surf Ops 240222 PE-OPE-0002-R02_Drying room and wetsuit management.pdf | GVF | capex | working_paper | 40 | 21 | de9c3c921b9197f1 | 2026-04-12T12:51:18.836183+00:00 | `eb1aeee5-d533-403b-b07a-1dd7f17d64ba` |

### 250 — mixed-type

Key: `16436hydcozzdrs1015|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-CO-ZZ-DR-S-1015.pdf | BHX | other | draft | 40 | 2 | 305af138efa48571 | 2026-04-12T07:36:47.36942+00:00 | `a8f6da49-0c3b-4f26-a4f5-d7268fb87c94` |
| 2 | 16436-HYD-CO-ZZ-DR-S-1015.pdf | BHX | other | executed | 0 | 142 | 5d28ee945043a076 | 2026-04-12T07:37:30.927608+00:00 | `b3aebc66-7b8a-4a13-af57-04ded4d74162` |

### 251 — mixed-type

Key: `16436hydth00dre5000|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-00-DR-E-5000.pdf | BHX | other | draft | 40 | 2 | 085507410eeaa11b | 2026-04-12T06:33:18.062751+00:00 | `254c8e50-be02-4f65-8287-98db1959e29e` |
| 2 | 16436-HYD-TH-00-DR-E-5000.pdf | BHX | other | draft | 40 | 4 | d23cbca28057f2ef | 2026-04-12T06:33:20.728796+00:00 | `d50ce87d-58c8-4db5-bce3-8044203ac126` |

### 252 — mixed-type

Key: `16436hydth00drm6000|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-00-DR-M-6000.pdf | BHX | other | draft | 40 | 3 | 1909ebb7c2b5d631 | 2026-04-12T06:54:32.709845+00:00 | `5016a24a-60f1-4fd1-af71-ab1e28eb18a0` |
| 2 | 16436-HYD-TH-00-DR-M-6000.pdf | BHX | other | draft | 40 | 3 | baf3311a7272b240 | 2026-04-12T06:54:42.079512+00:00 | `52b32ef8-fe0f-4a48-98e3-c48660097fbd` |

### 253 — mixed-type

Key: `16436hydthrfdrm5200|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-RF-DR-M-5200.pdf | BHX | other | draft | 40 | 2 | 147a24c19ec59a60 | 2026-04-12T06:53:48.518089+00:00 | `3c11249f-5946-4765-be41-e40a2923b689` |
| 2 | 16436-HYD-TH-RF-DR-M-5200.pdf | BHX | other | draft | 40 | 2 | a20ade09584c65f0 | 2026-04-12T06:53:45.023573+00:00 | `acc5e393-b977-46b7-8620-8b16cf34175f` |

### 254 — mixed-type

Key: `16436hydthxxscm1300|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-TH-XX-SC-M-1300.pdf | BHX | other | draft | 40 | 9 | 870eda0d4dbb8829 | 2026-04-12T07:09:48.239138+00:00 | `05ee7de0-9d62-4d1b-9ad9-470f276650bd` |
| 2 | 16436-HYD-TH-XX-SC-M-1300.pdf | BHX | general | draft | 40 | 85 | 313ca015e798da93 | 2026-04-12T07:19:07.543941+00:00 | `8b573859-9ccd-4f86-9cfd-8edf703e1bf3` |

### 255 — mixed-type

Key: `16436hydxxxxdrc0300manholeschedules|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 16436-HYD-XX-XX-DR-C-0300 Manhole Schedules.pdf | BHX | asset_management | executed | 40 | 7 | 8e491f251fcf84fc | 2026-04-12T05:59:25.340077+00:00 | `5fda4020-42b3-440a-8ca4-5cf6ac903881` |
| 2 | 16436-HYD-XX-XX-DR-C-0300 Manhole Schedules.pdf | BHX | asset_management | working_paper | 40 | 8 | f5164dc38b160dd4 | 2026-04-12T05:59:17.055194+00:00 | `e98e7322-5d88-4be0-8551-1d74964ee39f` |

### 256 — mixed-type

Key: `2010ahexx210hubelevations03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-E-xx-210-Hub Elevations-03.pdf | BHX | other | executed | 40 | 1 | 2dd4a520bca81b8a | 2026-04-12T04:10:36.119351+00:00 | `684c839b-1443-4a44-955e-5c2001a6489c` |
| 2 | 2010-A-H-E-xx-210-Hub Elevations-03.pdf | BHX | other | working_paper | 40 | 1 | f99f060049850e13 | 2026-04-12T04:00:23.862777+00:00 | `6b89f20e-611c-4286-a0ef-4fe44a150be7` |

### 257 — mixed-type

Key: `2010ahexx212hubelevations04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-E-xx-212-Hub Elevations-04.pdf | BHX | other | executed | 40 | 1 | 37438a8862f80de5 | 2026-04-12T03:59:56.057329+00:00 | `806dc18d-59da-4b00-84c2-e28ccf1ceae2` |
| 2 | 2010-A-H-E-xx-212-Hub Elevations-04.pdf | BHX | other | executed | 40 | 1 | 71a529cc6110c481 | 2026-04-12T04:11:22.286914+00:00 | `9c4d510e-cdb7-4aa7-832c-76c6fe9602b3` |

### 258 — mixed-type

Key: `2010ahexx213hubelevations05|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-E-xx-213-Hub Elevations-05.pdf | BHX | other | working_paper | 40 | 1 | 9dce6500137d8bc5 | 2026-04-12T04:00:09.955407+00:00 | `721f66c2-9e94-4fc5-b928-58e60967d1b7` |
| 2 | 2010-A-H-E-xx-213-Hub Elevations-05.pdf | BHX | other | executed | 40 | 1 | ae857f337b3387f1 | 2026-04-12T04:15:57.574665+00:00 | `9feedccd-6333-4b94-a29f-4cd6eacb8bcb` |

### 259 — mixed-type

Key: `2010ahsxx300hubsections01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-S-xx-300-HubSections-01.pdf | BHX | other | working_paper | 40 | 1 | 554866a8e3fa4f7e | 2026-04-12T04:01:23.17741+00:00 | `093a2ebe-f4bb-4be0-836b-7b475b4c7e4a` |
| 2 | 2010-A-H-S-xx-300-HubSections-01.pdf | BHX | asset_management | draft | 40 | 1 | 9de9fcb2b221bd64 | 2026-04-12T04:16:11.317633+00:00 | `68ff242c-e64b-4659-a38f-4247b0207390` |

### 260 — mixed-type

Key: `2010ahsxx301hubsections02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-H-S-xx-301-HubSections-02.pdf | BHX | other | working_paper | 40 | 1 | 27f66a04480fa84e | 2026-04-12T04:17:12.978401+00:00 | `11a05a24-bdcd-4496-b05e-7042da8e5027` |
| 2 | 2010-A-H-S-xx-301-HubSections-02.pdf | BHX | other | working_paper | 40 | 1 | 4baac132dbc45a8b | 2026-04-12T04:09:47.563646+00:00 | `5b9265ab-805f-4fe7-8f06-b4948c74ab0e` |

### 261 — mixed-type

Key: `2010amhcxx001glazingschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-001-GlazingSchedule-01.pdf | BHX | other | draft | 40 | 3 | 475f5bce22dca47a | 2026-04-12T01:37:52.297134+00:00 | `a9ea7fc2-e506-438f-ad8c-ca6a537a454b` |
| 2 | 2010-A-MH-C-xx-001-GlazingSchedule-01.pdf | BHX | other | draft | 40 | 3 | c8eb19f2df52d699 | 2026-04-12T10:23:01.07508+00:00 | `d73c6975-d026-48bb-84fb-74883984258d` |

### 262 — mixed-type

Key: `2010amhcxx100internaldoorschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-100-InternalDoorSchedule-01.pdf | BHX | other | draft | 40 | 3 | 1e15e6f57a8c7f14 | 2026-04-12T10:23:31.992876+00:00 | `3e607851-63a8-40bf-b21d-4cb6be01b2a6` |
| 2 | 2010-A-MH-C-xx-100-InternalDoorSchedule-01.pdf | BHX | other | working_paper | 40 | 3 | aca610b9ac727aef | 2026-04-12T01:38:25.728317+00:00 | `5921dad2-05b4-4c6b-8c7a-6ca358d06cf5` |

### 263 — mixed-type

Key: `2010amhcxx101internaldoorschedule02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-101-InternalDoorSchedule-02.pdf | BHX | other | draft | 40 | 3 | 377de602ca52271f | 2026-04-12T10:23:52.10522+00:00 | `9e940fdb-8ce2-4c63-a988-0b3443efa177` |
| 2 | 2010-A-MH-C-xx-101-InternalDoorSchedule-02.pdf | BHX | other | draft | 40 | 3 | fdcbe121eb0d76d5 | 2026-04-12T01:39:39.970436+00:00 | `a62b7cf5-58af-413d-9a35-790121be65da` |

### 264 — mixed-type

Key: `2010amhcxx102internaldoorschedule03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-102-InternalDoorSchedule-03.pdf | BHX | other | draft | 40 | 3 | 0f6c3f4ba5f70273 | 2026-04-12T01:39:20.887641+00:00 | `009a0f3e-255f-4605-ae67-dca968e687a0` |
| 2 | 2010-A-MH-C-xx-102-InternalDoorSchedule-03.pdf | BHX | other | draft | 40 | 3 | 9338c6e6f87172b1 | 2026-04-12T10:24:36.751979+00:00 | `a6dbc640-fcec-4301-8a2a-da62834eb354` |

### 265 — mixed-type

Key: `2010amhcxx110internalscreenschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-C-xx-110-InternalScreenSchedule-01.pdf | BHX | other | draft | 40 | 1 | 16b5f821d1a61cda | 2026-04-12T10:25:11.515985+00:00 | `193ebdbd-6317-4429-894f-9ad8c903b965` |
| 2 | 2010-A-MH-C-xx-110-InternalScreenSchedule-01.pdf | BHX | other | draft | 40 | 1 | fc0f0f074ba8c13b | 2026-04-12T01:39:01.392413+00:00 | `5b91325c-e788-4314-9748-63a7909608e6` |

### 266 — mixed-type

Key: `2010amhdxx010internalwallbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-010-InternalWallBuildups.pdf | BHX | other | draft | 40 | 2 | 889571d67525f0db | 2026-04-12T09:58:32.238114+00:00 | `4887b5e5-96cb-4de1-81ec-7ebca07394c2` |
| 2 | 2010-A-MH-D-xx-010-InternalWallBuildups.pdf | BHX | other | draft | 40 | 1 | 992621aa4e6c61cb | 2026-04-12T01:10:59.973191+00:00 | `fe5e9ad4-2ab2-45c3-bf5f-f0e524e41a5a` |

### 267 — mixed-type

Key: `2010amhdxx015ceilingbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-015-CeilingBuildups.pdf | BHX | other | draft | 40 | 2 | b53b747555235002 | 2026-04-12T09:58:55.672015+00:00 | `61caade8-5587-4bf7-b97a-5c031f5f7500` |
| 2 | 2010-A-MH-D-xx-015-CeilingBuildups.pdf | BHX | other | draft | 40 | 2 | f905bc1cd1c00102 | 2026-04-12T01:11:54.861759+00:00 | `fcfd3de1-e2d1-4a3c-8167-9bd869cd15c3` |

### 268 — mixed-type

Key: `2010amhdxx040basedetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-040-BaseDetail.pdf | BHX | other | draft | 40 | 1 | 00ebbd82b0b85458 | 2026-04-12T01:11:14.895181+00:00 | `8032e23b-4fc2-4ceb-baff-ac5e8e0b1c14` |
| 2 | 2010-A-MH-D-xx-040-BaseDetail.pdf | BHX | other | draft | 40 | 2 | 8b6ba0a284185ce0 | 2026-04-12T09:58:38.075851+00:00 | `95748979-83ae-4480-b081-a35ff310ce99` |

### 269 — mixed-type

Key: `2010amhdxx042plandetailplantroominterface|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-042-PlanDetail-PlantRoomInterface.pdf | BHX | other | draft | 40 | 1 | f48f97e2f048edec | 2026-04-12T09:58:49.023534+00:00 | `293e9762-d229-4dba-8396-009f602ac98c` |
| 2 | 2010-A-MH-D-xx-042-PlanDetail-PlantRoomInterface.pdf | BHX | other | draft | 40 | 1 | 8a531a0e5135d214 | 2026-04-12T01:12:08.234518+00:00 | `4f09150a-24b2-417c-8d6a-6746324f8477` |

### 270 — mixed-type

Key: `2010amhdxx047vergedetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-047-VergeDetail.pdf | BHX | other | draft | 40 | 1 | bffc1bd2ab1ca960 | 2026-04-12T01:12:22.671416+00:00 | `35347995-1c2a-43cc-a6d8-90629b22dffd` |
| 2 | 2010-A-MH-D-xx-047-VergeDetail.pdf | BHX | other | draft | 40 | 1 | 7fb19bf9b53b45b2 | 2026-04-12T10:00:13.814222+00:00 | `b5c1e5c5-e234-4874-bfe2-6c3bdb009bc8` |

### 271 — mixed-type

Key: `2010amhdxx052glazeddoorplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-052-GlazedDoorPlan.pdf | BHX | other | draft | 40 | 1 | 6fd1c5a12b4e56a0 | 2026-04-12T01:14:10.965738+00:00 | `77ccbc68-cfb3-4551-b0d1-5642299a66ea` |
| 2 | 2010-A-MH-D-xx-052-GlazedDoorPlan.pdf | BHX | other | draft | 40 | 1 | 69095e5fa1c0d017 | 2026-04-12T10:00:51.455116+00:00 | `b8cbe87b-4828-45dd-b416-0b9e2972168e` |

### 272 — mixed-type

Key: `2010amhdxx060typicalrollerdoorbase|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-060-TypicalRollerDoorBase.pdf | BHX | other | draft | 40 | 1 | 333d81c514b26d4b | 2026-04-12T10:00:13.699108+00:00 | `558aec03-2a2c-494f-9c34-3848c1d06699` |
| 2 | 2010-A-MH-D-xx-060-TypicalRollerDoorBase.pdf | BHX | other | draft | 40 | 1 | 93c2c8f6eeff6845 | 2026-04-12T01:13:57.614249+00:00 | `b1fe07c1-b555-426a-806f-706a0ae9e44d` |

### 273 — mixed-type

Key: `2010amhdxx062typicalrollerdoorplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-062-TypicalRollerDoorPlan.pdf | BHX | other | draft | 40 | 1 | 3650bde6e60789ac | 2026-04-12T10:01:20.825893+00:00 | `5e972f0a-e799-42b0-ac96-5d14ed21a69b` |
| 2 | 2010-A-MH-D-xx-062-TypicalRollerDoorPlan.pdf | BHX | other | draft | 40 | 1 | 171388914d0d1eb5 | 2026-04-12T01:13:43.971994+00:00 | `c47c55c7-cbd8-4428-b5c6-6aaa8be36ec1` |

### 274 — mixed-type

Key: `2010amhdxx100typicalpartitionsections|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-100-TypicalPartitionSections.pdf | BHX | other | draft | 40 | 1 | fa12cda376232991 | 2026-04-12T01:15:19.219666+00:00 | `644236d3-fac3-4735-96d2-ebb4c1539dad` |
| 2 | 2010-A-MH-D-xx-100-TypicalPartitionSections.pdf | BHX | other | draft | 40 | 1 | d9476ac99f310a7f | 2026-04-12T10:01:38.143049+00:00 | `df8bedec-fcd9-4461-a021-76c8b523561a` |

### 275 — mixed-type

Key: `2010amhdxx105partitionsections01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-105-PartitionSections-01.pdf | BHX | other | draft | 40 | 1 | 90edf03c81d19288 | 2026-04-12T10:01:08.294439+00:00 | `25e9db82-3da7-4647-a989-ebf1f7a1c8af` |
| 2 | 2010-A-MH-D-xx-105-PartitionSections-01.pdf | BHX | other | draft | 40 | 3 | c95f0462a5c85828 | 2026-04-12T01:15:05.443098+00:00 | `8564b32b-1910-467e-9126-1dc6eb636c31` |

### 276 — mixed-type

Key: `2010amhdxx106partitionsections02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-106-PartitionSections-02.pdf | BHX | other | draft | 40 | 1 | c5ce5d535bebbcab | 2026-04-12T10:01:24.235269+00:00 | `3dd9de9b-f9f1-4f7a-b00e-45af9ef5dc4f` |
| 2 | 2010-A-MH-D-xx-106-PartitionSections-02.pdf | BHX | other | draft | 40 | 2 | ccd3bea455dcf90e | 2026-04-12T01:14:38.766164+00:00 | `ebe364f1-9930-42d0-b443-d2d02f074432` |

### 277 — mixed-type

Key: `2010amhdxx117partitionplans03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-117-PartitionPlans-03.pdf | BHX | other | draft | 40 | 1 | 1194adfacc018fe7 | 2026-04-12T01:15:47.055743+00:00 | `8736a257-65d8-4e82-9222-fef50b2f202a` |
| 2 | 2010-A-MH-D-xx-117-PartitionPlans-03.pdf | BHX | other | draft | 40 | 1 | d9b7406c086ad0fa | 2026-04-12T10:02:55.840704+00:00 | `bba9ad1e-8936-48f7-8c2b-4dfa1fb1ef4a` |

### 278 — mixed-type

Key: `2010amhdxx118partitionplans04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-118-PartitionPlans-04.pdf | BHX | other | draft | 40 | 1 | 921d054b6b0f1731 | 2026-04-12T01:16:00.571125+00:00 | `79bdc52c-13c6-46c3-b5f8-8f1c83f34d0b` |
| 2 | 2010-A-MH-D-xx-118-PartitionPlans-04.pdf | BHX | other | draft | 40 | 1 | 911b78a08aafb332 | 2026-04-12T10:02:20.610922+00:00 | `f21a8771-2dfe-4113-a36d-cb2928453002` |

### 279 — mixed-type

Key: `2010amhdxx200staffroom|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-XX-200-StaffRoom.pdf | BHX | other | draft | 40 | 1 | 8c7e30e82299529c | 2026-04-12T09:56:25.180883+00:00 | `d3d55412-1d77-431b-9612-8b44d651fb02` |
| 2 | 2010-A-MH-D-xx-200-StaffRoom.pdf | BHX | other | draft | 40 | 1 | da37ccba5c059a9c | 2026-04-12T01:16:40.742042+00:00 | `ea1404ed-6771-4d77-b6a7-63c8328227e5` |

### 280 — mixed-type

Key: `2010amhdxx210dryboardstore|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-XX-210-DryBoardStore.pdf | BHX | other | draft | 40 | 1 | c279570874fa26df | 2026-04-12T09:58:15.656429+00:00 | `05fd627a-e4ed-4757-b1e5-5a0ab62fcf89` |
| 2 | 2010-A-MH-D-xx-210-DryBoardStore.pdf | BHX | other | draft | 40 | 1 | 56ae0538189ee1dc | 2026-04-12T01:17:22.072997+00:00 | `07045ec1-1177-4194-9f18-6153174a7852` |

### 281 — mixed-type

Key: `2010amhdxx215changing|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-XX-215-Changing.pdf | BHX | other | draft | 40 | 1 | 7a3b9f3f8357bbf8 | 2026-04-12T09:57:58.24884+00:00 | `66e52fd6-1ae4-4b10-b3a1-472e8635665e` |
| 2 | 2010-A-MH-D-xx-215-Changing.pdf | BHX | other | draft | 40 | 1 | 82fd9debebbf9c29 | 2026-04-12T01:16:55.094055+00:00 | `f96abc81-3cd3-4be5-aa8f-2d3c80f0fa0d` |

### 282 — mixed-type

Key: `2010amhdxx220wc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-220-WC.pdf | BHX | other | draft | 40 | 1 | af9189e577c9def1 | 2026-04-12T01:17:08.835521+00:00 | `550161b4-ad97-4c55-bf53-fa2548a71b6e` |
| 2 | 2010-A-MH-D-xx-220-WC.pdf | BHX | other | draft | 40 | 1 | 1f13f8eef282d3c6 | 2026-04-12T10:02:36.397394+00:00 | `dd2fce32-c270-48fe-aed2-8c8942c26c0e` |

### 283 — mixed-type

Key: `2010amhdxx221wc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-221-WC.pdf | BHX | other | draft | 40 | 1 | d6f75afa58977fd3 | 2026-04-12T01:17:48.837656+00:00 | `1d7c93b0-507b-4a65-91e2-0645fbce1e8e` |
| 2 | 2010-A-MH-D-xx-221-WC.pdf | BHX | other | draft | 40 | 1 | 7c748aa9547a04de | 2026-04-12T08:44:35.940614+00:00 | `78c6b18c-e07b-49f4-a804-4823197f4245` |

### 284 — mixed-type

Key: `2010amhdxx225dwc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-D-xx-225-DWC.pdf | BHX | other | draft | 40 | 1 | 536f1825087dcdbc | 2026-04-12T01:18:48.939586+00:00 | `64cdb65e-a451-4703-8dcc-d18868e75279` |
| 2 | 2010-A-MH-D-xx-225-DWC.pdf | BHX | other | draft | 40 | 1 | 7e4d5f20d9c4f88d | 2026-04-12T10:03:22.965797+00:00 | `c6896c4c-8aa3-44f7-ab99-d1b7794ca8a2` |

### 285 — mixed-type

Key: `2010amhexx200maintenancebuildingelevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-E-xx-200-MaintenanceBuildingElevations.pdf | BHX | other | executed | 40 | 1 | 8d391f15bf577655 | 2026-04-12T04:16:39.942512+00:00 | `be2208bb-bbf0-4995-964a-7ce590970079` |
| 2 | 2010-A-MH-E-xx-200-MaintenanceBuildingElevations.pdf | BHX | other | working_paper | 40 | 1 | a212147c3ac4448a | 2026-04-12T04:09:13.997487+00:00 | `f139c78b-08bb-4313-9c09-747129e1f0e8` |

### 286 — mixed-type

Key: `2010amhp00100groundfloorplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-P-00-100-GroundFloorPlan.pdf | BHX | other | draft | 40 | 1 | 75ec24ef5de5e0af | 2026-04-12T08:47:04.0199+00:00 | `06b2b7b4-f4de-47f1-81f9-05758de77d4a` |
| 2 | 2010-A-MH-P-00-100-GroundFloorPlan.pdf | BHX | other | draft | 40 | 2 | 5fafd575b2d29bbf | 2026-04-12T03:24:25.219551+00:00 | `3096a2bc-62ef-442b-9435-e9f93e952330` |

### 287 — mixed-type

Key: `2010amhp00120finishesplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-P-00-120-FinishesPlan.pdf | BHX | other | draft | 40 | 3 | a14b054065c25827 | 2026-04-12T03:27:20.069354+00:00 | `55713005-b396-4d00-b297-e7853f1b051f` |
| 2 | 2010-A-MH-P-00-120-FinishesPlan.pdf | BHX | other | executed | 40 | 2 | 8108dc9f138c0cd7 | 2026-04-12T08:47:23.954069+00:00 | `6e44a814-09f9-4fef-808b-8135cf774f98` |

### 288 — mixed-type

Key: `2010amhprf101roofplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-MH-P-RF-101-RoofPlan.pdf | BHX | other | draft | 40 | 1 | 8a14c0140bd1c6c8 | 2026-04-12T03:27:01.175416+00:00 | `7c0ef941-06a3-4100-9be4-5c20c0992a28` |
| 2 | 2010-A-MH-P-RF-101-RoofPlan.pdf | BHX | other | draft | 40 | 1 | a51c2ba25932aa52 | 2026-04-12T08:47:36.885506+00:00 | `cd8d8b19-9de1-40ca-9ed8-ca46b5de95a9` |

### 289 — mixed-type

Key: `2010apadxx001floorbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-001-Floor Buildups.pdf | BHX | other | draft | 40 | 2 | 7c5168e03a883d50 | 2026-04-12T01:18:35.680426+00:00 | `8a8900cc-3b63-4f4a-9bc6-69771d992135` |
| 2 | 2010-A-PA-D-xx-001-Floor Buildups.pdf | BHX | other | draft | 40 | 2 | d6956586038467c5 | 2026-04-12T10:03:42.790332+00:00 | `b7aa53a3-4d10-406f-9dfa-ebfac1dc08a9` |

### 290 — mixed-type

Key: `2010apadxx005externalwallbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-005-External Wall Buildups.pdf | BHX | other | draft | 40 | 1 | 4d48934f2f379c21 | 2026-04-12T10:03:57.713916+00:00 | `b803373b-9140-468a-bc3f-6ad276b15f27` |
| 2 | 2010-A-PA-D-xx-005-External Wall Buildups.pdf | BHX | other | draft | 40 | 1 | ef4d0eb58f5219d4 | 2026-04-12T01:18:03.570711+00:00 | `d757a2f3-3489-4e41-906b-2ab2529d020c` |

### 291 — mixed-type

Key: `2010apadxx020grounddetailchanging|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-020-GroundDetail-Changing.pdf | BHX | other | draft | 40 | 1 | edeaf24bec3a6969 | 2026-04-12T10:04:12.573023+00:00 | `33a6f807-50b1-4135-b85a-17fa3967ef37` |
| 2 | 2010-A-PA-D-xx-020-GroundDetail-Changing.pdf | BHX | other | draft | 40 | 1 | e4c6fc7c614e76a3 | 2026-04-12T01:19:56.637971+00:00 | `63d39e30-0b55-4ea6-ab06-09511f940f7b` |

### 292 — mixed-type

Key: `2010apadxx022grounddetailoutdoorshowers|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-022-GroundDetail-OutdoorShowers.pdf | BHX | other | draft | 40 | 1 | 77b2490a0241c098 | 2026-04-12T10:04:29.238218+00:00 | `2868f76c-f8e5-4164-83e7-6c2f7bc45084` |
| 2 | 2010-A-PA-D-xx-022-GroundDetail-OutdoorShowers.pdf | BHX | other | draft | 40 | 1 | d2dcbc5d4586f901 | 2026-04-12T01:19:43.299754+00:00 | `e675c7ab-2787-4c22-a185-7667b2612073` |

### 293 — mixed-type

Key: `2010apadxx023grounddetailaccessiblewcchanging|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-023-GroundDetail-AccessibleWC-Changing.pdf | BHX | other | draft | 40 | 1 | 5b148c1c42cef9da | 2026-04-12T10:05:09.078137+00:00 | `b45ef8b6-a036-453e-8b6c-dc814cc7b5d9` |
| 2 | 2010-A-PA-D-xx-023-GroundDetail-AccessibleWC-Changing.pdf | BHX | other | draft | 40 | 1 | beb07502b1e5ad57 | 2026-04-12T01:19:16.558167+00:00 | `da102b8c-c099-47d4-9954-63e97dbf5951` |

### 294 — mixed-type

Key: `2010apadxx030roofdetailchanging|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-030-RoofDetail-Changing.pdf | BHX | other | draft | 40 | 1 | 1941245f67803a7e | 2026-04-12T01:19:29.602687+00:00 | `11049119-8070-4022-8eeb-e5b23c54add5` |
| 2 | 2010-A-PA-D-xx-030-RoofDetail-Changing.pdf | BHX | other | draft | 40 | 1 | 3c2a8bccc26e4c2c | 2026-04-12T10:05:28.23387+00:00 | `ff7e5a46-4d64-4417-b90c-ce97ada6f95b` |

### 295 — mixed-type

Key: `2010apadxx031roofdetailshowers|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-031-RoofDetail-Showers.pdf | BHX | other | draft | 40 | 1 | 6ac0036abe68fea2 | 2026-04-12T01:20:09.69638+00:00 | `2cd9ae09-b020-4bee-aec2-7e91151b0305` |
| 2 | 2010-A-PA-D-xx-031-RoofDetail-Showers.pdf | BHX | other | draft | 40 | 1 | 8fbb5d4f125e0d43 | 2026-04-12T10:04:57.579233+00:00 | `c115f750-c404-4129-bafb-ab92eabd08ef` |

### 296 — mixed-type

Key: `2010apadxx035vergedetailchangingshowers|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-035-VergeDetail-Changing&Showers.pdf | BHX | other | draft | 40 | 1 | b3035ffeac592089 | 2026-04-12T01:21:05.481545+00:00 | `a24cf899-20ac-49d0-a956-6fae15166cdb` |
| 2 | 2010-A-PA-D-xx-035-VergeDetail-Changing&Showers.pdf | BHX | other | draft | 40 | 1 | e8fa39ea5d563861 | 2026-04-12T10:05:12.693911+00:00 | `b291405c-e1b7-40a2-9cf2-4c37dbb07d34` |

### 297 — mixed-type

Key: `2010apadxx050changingshowerdoordetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-050-Changing&ShowerDoorDetail.pdf | BHX | other | draft | 40 | 1 | b84ac89a85954ff9 | 2026-04-12T01:20:37.313731+00:00 | `2639d6ad-48b7-4993-8c75-85a85ab8191c` |
| 2 | 2010-A-PA-D-xx-050-Changing&ShowerDoorDetail.pdf | BHX | other | draft | 40 | 1 | ea2aff482953d22e | 2026-04-12T10:05:28.847407+00:00 | `c956e340-4b49-43d1-b44a-932f010a1c73` |

### 298 — mixed-type

Key: `2010apadxx205detailedroomdwc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-XX-205-DetailedRoom-DWC.pdf | BHX | other | draft | 40 | 1 | 4b666fef58f72cd6 | 2026-04-12T10:02:57.0157+00:00 | `23285829-58ae-4bf9-8a6d-4d412db79f5d` |
| 2 | 2010-A-PA-D-xx-205-DetailedRoom-DWC.pdf | BHX | other | draft | 40 | 1 | 2c20982b7a46c1b8 | 2026-04-12T01:21:33.477814+00:00 | `efa2fd73-c663-4a51-a086-c791b5bfb115` |

### 299 — mixed-type

Key: `2010apadxx210detailedroomshowercubicle|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-210-DetailedRoom-ShowerCubicle.pdf | BHX | other | draft | 40 | 1 | b01aea0cc84f030b | 2026-04-12T01:21:46.851829+00:00 | `a99aef02-e555-4673-b8ec-419e0db1a25b` |
| 2 | 2010-A-PA-D-XX-210-DetailedRoom-ShowerCubicle.pdf | BHX | other | draft | 40 | 1 | 5e7dfc1efd4ddc77 | 2026-04-12T10:03:14.92986+00:00 | `d0a80cf8-3027-48e7-bb7e-8dd432d354d0` |

### 300 — mixed-type

Key: `2010apadxx220detailedroomtypicalwc|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-D-xx-220-DetailedRoom-TypicalWC.pdf | BHX | other | draft | 40 | 1 | 680dd5257386b664 | 2026-04-12T01:23:28.270554+00:00 | `8f68ffa2-04c2-46b2-bc4e-56e110f49e18` |
| 2 | 2010-A-PA-D-XX-220-DetailedRoom-TypicalWC.pdf | BHX | other | draft | 40 | 1 | f7a1779e2cf20711 | 2026-04-12T10:04:13.05534+00:00 | `a1f5dc11-3774-4283-9a96-43f12fefbb88` |

### 301 — mixed-type

Key: `2010apae201elevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-E-201-Elevations.pdf | BHX | other | draft | 40 | 2 | 5336baa96c34e36c | 2026-04-12T08:48:55.304761+00:00 | `ae2d707e-3e73-4dbe-acdf-82e30ec772c6` |
| 2 | 2010-A-PA-E-201-Elevations.pdf | BHX | other | draft | 40 | 1 | d48de4dd23f05aa4 | 2026-04-12T03:27:33.799405+00:00 | `d3f1582c-8e27-4260-9412-ab0bd7240eae` |

### 302 — mixed-type

Key: `2010apap00100practiceareaplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-00-100-PracticeAreaPlan.pdf | BHX | general | executed | 40 | 3 | c7e0c0ad0cda81d1 | 2026-04-12T04:11:08.645288+00:00 | `58436975-0850-4655-97bb-881cbafe7106` |
| 2 | 2010-A-PA-P-00-100-PracticeAreaPlan.pdf | BHX | asset_management | unknown | 40 | 5 | 55e06ad6cc062339 | 2026-04-12T04:29:47.179009+00:00 | `8702f8f1-3454-43cb-8648-9d1fd659b4b5` |

### 303 — mixed-type

Key: `2010apap00161changingroomswallbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-P-00-161-ChangingRooms-WallBuildups.pdf | BHX | other | draft | 40 | 2 | d2d645f4d099a7b3 | 2026-04-12T03:27:54.564271+00:00 | `24da0869-6e65-4343-bcf4-7b2614e2a278` |
| 2 | 2010-A-PA-P-00-161-ChangingRooms-WallBuildups.pdf | BHX | other | draft | 40 | 2 | 4826cd618ae7b69b | 2026-04-12T08:48:52.707156+00:00 | `55132054-d745-46b2-9f82-2f47ab327320` |

### 304 — mixed-type

Key: `2010apas301sections02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-PA-S-301-Sections 02.pdf | BHX | other | unknown | 40 | 1 | 5062011496a0f9af | 2026-04-12T08:51:40.040675+00:00 | `105d9483-fe3a-4e30-932a-26608a78c126` |
| 2 | 2010-A-PA-S-301-Sections 02.pdf | BHX | other | unknown | 10 | 1 | 02a3c051294db0e8 | 2026-04-12T03:31:19.167471+00:00 | `d623b89f-9dd5-41c3-a957-33c5e03ff1e2` |

### 305 — mixed-type

Key: `2010ashcxx001glazingschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-001-GlazingSchedule-01.pdf | BHX | other | draft | 40 | 3 | e37a26b4bc8959be | 2026-04-12T01:23:14.839344+00:00 | `b7ecfbb7-cb98-4f5b-a509-64e31a3196c1` |
| 2 | 2010-A-SH-C-xx-001-GlazingSchedule-01.pdf | BHX | other | draft | 40 | 3 | 5ea2f4a61468220c | 2026-04-12T10:24:41.845602+00:00 | `e4e3c5bb-180b-49bf-ba5f-e3bc75dac10e` |

### 306 — mixed-type

Key: `2010ashcxx002glazingschedule02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-002-GlazingSchedule-02.pdf | BHX | legal | draft | 40 | 3 | 68d54f1fadc071e8 | 2026-04-12T01:22:47.726917+00:00 | `4d480c4d-3aa5-4a32-a213-e18bda1fdc37` |
| 2 | 2010-A-SH-C-xx-002-GlazingSchedule-02.pdf | BHX | other | draft | 40 | 3 | 9deb303db591c7a3 | 2026-04-12T10:24:56.029547+00:00 | `66a1eca9-2075-4f24-b3f1-ca6e0e65def0` |
| 3 | 2010-A-SH-C-xx-002-GlazingSchedule-02.pdf | BHX | other | draft | 40 | 3 | 650dc1441e386ee5 | 2026-04-12T10:24:56.846334+00:00 | `b9d9b8ea-ad13-4b87-9303-171b8e06b1fd` |

### 307 — mixed-type

Key: `2010ashcxx004glazingschedule04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-004-GlazingSchedule-04.pdf | BHX | other | draft | 40 | 3 | 45c727cb2b771bff | 2026-04-12T10:25:53.055825+00:00 | `b00b6dd8-171b-440b-9d0d-09cb09d3ce77` |
| 2 | 2010-A-SH-C-xx-004-GlazingSchedule-04.pdf | BHX | other | draft | 40 | 2 | 98aa6b35804fedb3 | 2026-04-12T01:23:41.449971+00:00 | `d3bed64d-8859-431d-b702-37cbc1c165c2` |

### 308 — mixed-type

Key: `2010ashcxx007glazingschedule07|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-007-GlazingSchedule-07.pdf | BHX | other | draft | 40 | 3 | 4501d0be888b8201 | 2026-04-12T10:25:54.798204+00:00 | `1d3b5b56-a1fc-4b09-8dce-1a30b45ec66e` |
| 2 | 2010-A-SH-C-xx-007-GlazingSchedule-07.pdf | BHX | other | draft | 40 | 3 | c8ea9c7dc8daed91 | 2026-04-12T01:23:56.131652+00:00 | `d2e3cde5-9596-4c6f-a301-ca47954dd04b` |

### 309 — mixed-type

Key: `2010ashcxx010externaldoorschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-010-ExternalDoorSchedule-01.pdf | BHX | other | draft | 40 | 6 | b7076866e74a9fb9 | 2026-04-12T10:26:13.767778+00:00 | `128a4dce-2f7e-4faf-9fd3-cc3c5470d697` |
| 2 | 2010-A-SH-C-xx-010-ExternalDoorSchedule-01.pdf | BHX | other | draft | 40 | 6 | 82e0662e050d541c | 2026-04-12T01:24:15.267099+00:00 | `477f16c6-1791-49ab-8411-9c8eddf82818` |

### 310 — mixed-type

Key: `2010ashcxx015rooflightschedule01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-015-RooflightSchedule-01.pdf | BHX | other | draft | 40 | 2 | 593259484c674fe5 | 2026-04-12T10:26:28.69648+00:00 | `47811a56-e613-4b90-9944-3ac99c4792cb` |
| 2 | 2010-A-SH-C-xx-015-RooflightSchedule-01.pdf | BHX | other | draft | 40 | 2 | fec6a48988a7322e | 2026-04-12T01:25:00.925068+00:00 | `d0e06424-0297-4b8a-9dc6-c8c5efbc3938` |

### 311 — mixed-type

Key: `2010ashcxx101internaldoorelevations02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-101-InternalDoorElevations-02.pdf | BHX | asset_management | draft | 40 | 3 | 81bfa04c015e9b93 | 2026-04-12T10:28:34.886975+00:00 | `04d3d1a9-3177-435b-bbe2-a5a516acd41b` |
| 2 | 2010-A-SH-C-xx-101-InternalDoorElevations-02.pdf | BHX | other | draft | 40 | 3 | 24bef6e0701c38e0 | 2026-04-12T01:25:22.812967+00:00 | `68ab3e56-b3ec-434d-8110-d0db0f33f0b7` |

### 312 — mixed-type

Key: `2010ashcxx102internaldoorelevations03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-102-InternalDoorElevations-03.pdf | BHX | other | draft | 40 | 3 | 99d5ba8a665f6e94 | 2026-04-12T10:27:54.255709+00:00 | `10434c6b-8df4-4de5-9c3d-dce44fcf782b` |
| 2 | 2010-A-SH-C-xx-102-InternalDoorElevations-03.pdf | BHX | other | draft | 40 | 3 | 9774ba6ea2641ab0 | 2026-04-12T01:25:42.082896+00:00 | `e85ddbd8-3057-4c4d-9172-95e78a3ebbbd` |

### 313 — mixed-type

Key: `2010ashcxx104internaldoorelevations05|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-104-InternalDoorElevations-05.pdf | BHX | other | working_paper | 40 | 3 | 8f1b8c6b665eec2c | 2026-04-12T01:28:04.644808+00:00 | `089833a0-7b2b-4539-b24f-93d41ec93d7e` |
| 2 | 2010-A-SH-C-xx-104-InternalDoorElevations-05.pdf | BHX | other | working_paper | 40 | 3 | 13879703fe6f1c62 | 2026-04-12T10:29:21.239572+00:00 | `cf944572-aa1c-48cc-bf68-ba769f148457` |

### 314 — mixed-type

Key: `2010ashcxx105internaldoorelevations06|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-105-InternalDoorElevations-06.pdf | BHX | other | working_paper | 40 | 3 | e4c5a82b5ad86e53 | 2026-04-12T01:27:45.257883+00:00 | `56a00764-7519-4d9e-a621-64cc0790514b` |
| 2 | 2010-A-SH-C-xx-105-InternalDoorElevations-06.pdf | BHX | other | working_paper | 40 | 3 | 4775f690b8a3505f | 2026-04-12T10:30:43.685484+00:00 | `c798f026-e33a-47a6-ab5a-3f598828bb24` |

### 315 — mixed-type

Key: `2010ashcxx106internaldoorelevations07|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-106-InternalDoorElevations-07.pdf | BHX | other | working_paper | 40 | 4 | cbc4e0bdf45d9565 | 2026-04-12T10:30:23.374691+00:00 | `3e718102-8a8b-4e18-a34c-67e2250f1640` |
| 2 | 2010-A-SH-C-xx-106-InternalDoorElevations-07.pdf | BHX | other | working_paper | 40 | 4 | 7222a6f97a4f5913 | 2026-04-12T01:27:06.628517+00:00 | `5fc8cb21-f0fe-4848-aa33-765f0dcadf79` |

### 316 — mixed-type

Key: `2010ashcxx108internaldoorelevations09|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-108-InternalDoorElevations-09.pdf | BHX | other | draft | 40 | 2 | dcec173d1dcfea4f | 2026-04-12T10:30:02.920936+00:00 | `32e8ecb6-5ad8-4404-9623-bcad9acb6602` |
| 2 | 2010-A-SH-C-xx-108-InternalDoorElevations-09.pdf | BHX | other | draft | 40 | 2 | a605b5ec27436148 | 2026-04-12T01:28:18.349579+00:00 | `ce4ae592-c83b-4683-9c6d-7cafcae8c458` |

### 317 — mixed-type

Key: `2010ashcxx111internaldoorelevations12|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-111-InternalDoorElevations-12.pdf | BHX | other | working_paper | 40 | 3 | 7169c1373465819a | 2026-04-12T01:28:39.144381+00:00 | `4f7e87d5-6c30-4eaf-b19c-628461cd1265` |
| 2 | 2010-A-SH-C-xx-111-InternalDoorElevations-12.pdf | BHX | other | draft | 40 | 2 | ed6c43c39809d366 | 2026-04-12T10:32:00.827715+00:00 | `ff61f592-2a85-4295-892b-9d54d34b119a` |

### 318 — mixed-type

Key: `2010ashcxx112internaldoorelevations13|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-112-InternalDoorElevations-13.pdf | BHX | asset_management | draft | 40 | 3 | 4d6bcdfe472de690 | 2026-04-12T01:28:58.628748+00:00 | `303960c0-5a09-4400-a9b4-b9d1247ee1f0` |
| 2 | 2010-A-SH-C-xx-112-InternalDoorElevations-13.pdf | BHX | other | draft | 40 | 3 | 525410142713a8c7 | 2026-04-12T10:31:25.405587+00:00 | `455da908-fc94-4a00-ae9b-17c88edda6ec` |

### 319 — mixed-type

Key: `2010ashcxx113internaldoorelevations14|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-113-InternalDoorElevations-14.pdf | BHX | other | draft | 40 | 2 | f57a0cd51b367f21 | 2026-04-12T10:31:45.800298+00:00 | `a9b11ea4-2461-4056-b1bc-e61a8b8fb425` |
| 2 | 2010-A-SH-C-xx-113-InternalDoorElevations-14.pdf | BHX | other | draft | 40 | 3 | 323d09a94bdaa6cd | 2026-04-12T01:29:56.903503+00:00 | `f7463ea0-67c1-4717-b198-fe7e751af3ad` |

### 320 — mixed-type

Key: `2010ashcxx114internaldoorelevations15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-114-InternalDoorElevations-15.pdf | BHX | other | working_paper | 40 | 5 | 7da3bd3d2ead97b3 | 2026-04-12T10:32:40.793684+00:00 | `00094232-19fa-409c-a822-47413b06801a` |
| 2 | 2010-A-SH-C-xx-114-InternalDoorElevations-15.pdf | BHX | other | working_paper | 40 | 5 | 590d8b6f19f43ec0 | 2026-04-12T01:31:15.806251+00:00 | `8a23206d-1c6e-4fd3-82ae-00a98910c77f` |

### 321 — mixed-type

Key: `2010ashcxx115internaldoorelevations16|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-115-InternalDoorElevations-16.pdf | BHX | other | draft | 40 | 3 | b8a6b6c13997a759 | 2026-04-12T01:30:56.318104+00:00 | `ce488508-1602-458d-a625-3287effcc277` |
| 2 | 2010-A-SH-C-xx-115-InternalDoorElevations-16.pdf | BHX | other | draft | 40 | 3 | 558df7f1d44c77f3 | 2026-04-12T10:33:57.379677+00:00 | `f00a7e84-4d05-4d20-9b62-11074586cb46` |

### 322 — mixed-type

Key: `2010ashcxx116internaldoorelevations17|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-C-xx-116-InternalDoorElevations-17.pdf | BHX | other | working_paper | 40 | 3 | 6fdcfac515b65253 | 2026-04-12T01:30:17.455211+00:00 | `612d1e4e-aa30-4684-a485-e084447c4908` |
| 2 | 2010-A-SH-C-xx-116-InternalDoorElevations-17.pdf | BHX | other | draft | 40 | 3 | 9ee62d3971143cda | 2026-04-12T10:33:36.961939+00:00 | `cde23c12-2992-47af-bbc2-8cc3c3db8513` |

### 323 — mixed-type

Key: `2010ashdxx002floorbuildups02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-002-FloorBuildups-02.pdf | BHX | other | draft | 40 | 2 | 83711795fd873bf5 | 2026-04-12T10:07:31.675472+00:00 | `2c6b3bcb-e715-4ccf-83ba-63bdf9017814` |
| 2 | 2010-A-SH-D-xx-002-FloorBuildups-02.pdf | BHX | other | draft | 40 | 2 | ada34da97f65a897 | 2026-04-12T00:13:04.685621+00:00 | `5d00856c-efab-40c4-ae20-b24f0c63f0f9` |

### 324 — mixed-type

Key: `2010ashdxx005upperfloorbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-005-UpperFloorBuildups.pdf | BHX | other | draft | 40 | 1 | bb76eaf3fda0a742 | 2026-04-12T00:14:26.020041+00:00 | `584d2d29-803c-42f4-803e-d8d18dfd6592` |
| 2 | 2010-A-SH-D-xx-005-UpperFloorBuildups.pdf | BHX | other | draft | 40 | 1 | 1302528fc6e32e4b | 2026-04-12T10:07:48.495188+00:00 | `6744ec74-da45-4fa3-9282-502705d819b6` |

### 325 — mixed-type

Key: `2010ashdxx015internalwallbuildups01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-015-InternalWallBuildups-01.pdf | BHX | other | working_paper | 40 | 4 | 6f9524989ffe8938 | 2026-04-12T00:13:48.622655+00:00 | `21744e17-945f-4688-bd86-ded067a4b598` |
| 2 | 2010-A-SH-D-xx-015-InternalWallBuildups-01.pdf | BHX | asset_management | draft | 40 | 4 | e19405a830137866 | 2026-04-12T10:09:50.844398+00:00 | `9d7bc1f4-974f-40eb-85dc-d4508ae92af2` |

### 326 — mixed-type

Key: `2010ashdxx016internalwallbuildups02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-016-InternalWallBuildups-02.pdf | BHX | other | draft | 40 | 3 | 3755dfc7e55a7682 | 2026-04-12T10:08:38.43332+00:00 | `5f5f5811-374b-4e7b-8a9d-50cf1e6aa513` |
| 2 | 2010-A-SH-D-xx-016-InternalWallBuildups-02.pdf | BHX | other | draft | 40 | 3 | 558ce16a3ecad3bb | 2026-04-12T00:14:55.868579+00:00 | `dab5be35-dd21-4100-8a33-2d5da89e1583` |

### 327 — mixed-type

Key: `2010ashdxx017internalwallbuildups03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-017-InternalWallBuildups-03.pdf | BHX | other | draft | 40 | 3 | f219c9a7a13412cb | 2026-04-12T10:09:13.392325+00:00 | `36418c61-b2b4-41cc-b758-c360add4cadf` |
| 2 | 2010-A-SH-D-xx-017-InternalWallBuildups-03.pdf | BHX | other | working_paper | 40 | 4 | d84b4d2808ffb07c | 2026-04-12T00:16:18.458115+00:00 | `6419a381-3c34-4321-8beb-d6e546412a52` |

### 328 — mixed-type

Key: `2010ashdxx020roofbuildups01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-020-RoofBuildups-01.pdf | BHX | other | working_paper | 40 | 4 | 4199d042701e432f | 2026-04-12T00:15:48.568933+00:00 | `275c0f2d-fa1d-4c4c-82db-7fc4ae7b22cb` |
| 2 | 2010-A-SH-D-xx-020-RoofBuildups-01.pdf | BHX | asset_management | draft | 40 | 4 | 68fdb299490a5139 | 2026-04-12T10:09:47.132614+00:00 | `cc69d2c9-643a-4b4e-acfd-78eb90568eca` |

### 329 — mixed-type

Key: `2010ashdxx025ceilingbuildups01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-025-CeilingBuildups-01.pdf | BHX | other | draft | 40 | 2 | c1f0069e29545c14 | 2026-04-12T00:15:23.801228+00:00 | `16107771-854f-408a-9a62-c8af4635a366` |
| 2 | 2010-A-SH-D-xx-025-CeilingBuildups-01.pdf | BHX | other | draft | 40 | 2 | 01cc2721e9562519 | 2026-04-12T10:09:02.143433+00:00 | `cd8b349e-47ec-4061-afb3-c9bc91f4f3f0` |

### 330 — mixed-type

Key: `2010ashdxx026ceilingbuildups02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-026-CeilingBuildups-02.pdf | BHX | other | draft | 40 | 2 | 74e9e4ae86bdd33b | 2026-04-12T00:16:31.74462+00:00 | `25452c77-53ab-45d2-ad61-791e910c6e70` |
| 2 | 2010-A-SH-D-xx-026-CeilingBuildups-02.pdf | BHX | other | draft | 40 | 2 | d5ddda64e8f196b0 | 2026-04-12T10:09:20.000834+00:00 | `e83db9d6-54e5-4c7f-8ac6-f837910ef688` |

### 331 — mixed-type

Key: `2010ashdxx028soffitbuildups|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-028-SoffitBuildups.pdf | BHX | other | draft | 40 | 2 | c639bfe2c15beaf2 | 2026-04-12T10:11:06.436629+00:00 | `3db3c42b-a428-431d-97c8-8b0d23a34666` |
| 2 | 2010-A-SH-D-xx-028-SoffitBuildups.pdf | BHX | other | draft | 40 | 2 | 69143a9775772815 | 2026-04-12T10:11:08.804829+00:00 | `6cfa3914-0800-4c57-ae2b-fe7e6e760f9b` |
| 3 | 2010-A-SH-D-xx-028-SoffitBuildups.pdf | BHX | other | draft | 40 | 2 | d42eb79ec84250c4 | 2026-04-12T00:17:18.917163+00:00 | `ae025a99-50db-45f1-89b9-261753bb2ecd` |

### 332 — mixed-type

Key: `2010ashdxx030elevationstudycladdingconditions|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-XX-030-ElevationStudy-CladdingConditions.pdf | BHX | other | draft | 40 | 2 | 591f85942538aff9 | 2026-04-12T10:06:50.579983+00:00 | `0f3afceb-b9d0-46f8-9f88-04d4f23a6ae5` |
| 2 | 2010-A-SH-D-xx-030-ElevationStudy-CladdingConditions.pdf | BHX | other | draft | 40 | 2 | 050331cd2c1c3665 | 2026-04-12T00:16:51.345914+00:00 | `2f56dbf6-607a-41ab-81db-6f61c9672e4b` |

### 333 — mixed-type

Key: `2010ashdxx031elevationstudycurtainwalling|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-031-ElevationStudy-CurtainWalling.pdf | BHX | other | draft | 40 | 1 | 621008167ae13bd0 | 2026-04-12T00:17:05.714116+00:00 | `3800ab11-5cbc-40fa-ae17-4015fea02929` |
| 2 | 2010-A-SH-D-XX-031-ElevationStudy-CurtainWalling.pdf | BHX | other | draft | 40 | 1 | 2c7a3a395c5469b6 | 2026-04-12T10:06:13.306621+00:00 | `ee56083e-ae4e-4044-b520-d613110a32cc` |

### 334 — mixed-type

Key: `2010ashdxx033elevationstudyentrancecorner|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-033-ElevationStudy-EntranceCorner.pdf | BHX | other | draft | 40 | 1 | 802bfe35e35a1cda | 2026-04-12T00:18:41.02677+00:00 | `a9f1ef80-96cd-4fd6-8c9a-c37118340ece` |
| 2 | 2010-A-SH-D-XX-033-ElevationStudy-EntranceCorner.pdf | BHX | other | draft | 40 | 1 | db137cce7768ecbb | 2026-04-12T10:07:14.913053+00:00 | `b943faff-0a38-4dc3-9700-baa6d45cde94` |

### 335 — mixed-type

Key: `2010ashdxx034elevationstudylouvrecladdingdetail|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-034-ElevationStudy-LouvreCladdingDetail.pdf | BHX | other | draft | 40 | 1 | 4a90a1fd8773c773 | 2026-04-12T00:18:27.005631+00:00 | `17d5b238-6af6-43bd-9aef-b102b1b939ba` |
| 2 | 2010-A-SH-D-XX-034-ElevationStudy-LouvreCladdingDetail.pdf | BHX | general | draft | 40 | 2 | 0154f5df32049e2b | 2026-04-12T10:07:36.809084+00:00 | `41d49ed4-eb40-4f06-8c15-d1064ac6d4bc` |

### 336 — mixed-type

Key: `2010ashdxx040basedetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-040-BaseDetail-01.pdf | BHX | other | draft | 40 | 1 | 0905159a096a4d19 | 2026-04-12T00:18:00.280172+00:00 | `17119bca-5e39-4f63-a590-62387141d4be` |
| 2 | 2010-A-SH-D-xx-040-BaseDetail-01.pdf | BHX | other | draft | 40 | 1 | bc546b89ddfef342 | 2026-04-12T10:10:49.885564+00:00 | `2b3ffa16-33a8-46fb-9f65-668410bc2907` |

### 337 — mixed-type

Key: `2010ashdxx045intermediateleveldetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-045-IntermediateLevelDetail-01.pdf | BHX | other | draft | 40 | 1 | f919e7a4ae711a84 | 2026-04-12T00:19:22.365863+00:00 | `2a8e9e25-81af-44bc-8e51-c40eeb23e7ac` |
| 2 | 2010-A-SH-D-xx-045-IntermediateLevelDetail-01.pdf | BHX | other | draft | 40 | 1 | 59c69b3e5e4c758d | 2026-04-12T10:12:21.148386+00:00 | `d93c6b86-c875-4866-94f7-b6a65443fec3` |

### 338 — mixed-type

Key: `2010ashdxx053plandetailsradiuscornernorth|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-053-PlanDetails-RadiusCorner-North.pdf | BHX | other | draft | 40 | 1 | c0a6779e931bd670 | 2026-04-12T10:12:35.756546+00:00 | `9d42310f-d6a4-4717-a655-161d2a2aab95` |
| 2 | 2010-A-SH-D-xx-053-PlanDetails-RadiusCorner-North.pdf | BHX | other | draft | 40 | 1 | e3ad0aa1ec441a46 | 2026-04-12T00:21:11.7236+00:00 | `fba71b85-cddb-499b-8521-288b88ccf888` |

### 339 — mixed-type

Key: `2010ashdxx055plandetailsmallradiuscornersouth|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-055-PlanDetail-SmallRadiusCorner-South.pdf | BHX | asset_management | draft | 40 | 1 | 0a90365baf853c32 | 2026-04-12T10:13:27.516076+00:00 | `59de3835-f03f-4fe5-9b8a-c9c8dab549f3` |
| 2 | 2010-A-SH-D-xx-055-PlanDetail-SmallRadiusCorner-South.pdf | BHX | other | draft | 40 | 1 | cda6cb43091cab72 | 2026-04-12T00:21:26.644325+00:00 | `c1fe8524-693b-4cf2-a481-a7224a3c47c0` |

### 340 — mixed-type

Key: `2010ashdxx058typicalfirestopping|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-058-TypicalFirestopping.pdf | BHX | other | draft | 40 | 1 | 630e1d5bb0b708a2 | 2026-04-12T10:12:52.063078+00:00 | `0c52e030-eddd-46c9-89a3-4e24a5fc34ef` |
| 2 | 2010-A-SH-D-xx-058-TypicalFirestopping.pdf | BHX | other | draft | 40 | 1 | 6f4775bdb95f155e | 2026-04-12T00:21:40.477844+00:00 | `61fab043-f7fc-4d46-8c0a-788212dc5484` |

### 341 — mixed-type

Key: `2010ashdxx062typicalcurvedeavesdetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-062-TypicalCurvedEavesDetails-01.pdf | BHX | other | draft | 40 | 1 | 19b33f3640bb1619 | 2026-04-12T00:23:02.053125+00:00 | `54442687-7fd6-42ab-bba6-9f6a1948e44f` |
| 2 | 2010-A-SH-D-xx-062-TypicalCurvedEavesDetails-01.pdf | BHX | other | draft | 40 | 1 | 3dca3ba3d31b5ee3 | 2026-04-12T10:13:20.120448+00:00 | `e0bd6a09-283f-4443-a7f5-953f89c677d5` |

### 342 — mixed-type

Key: `2010ashdxx064typicalvergedetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-064-TypicalVergeDetail-01.pdf | BHX | general | draft | 40 | 2 | 7bb2cd1b28916f68 | 2026-04-12T10:14:06.988651+00:00 | `901dc181-47b0-4e80-bd07-9185c29a6667` |
| 2 | 2010-A-SH-D-xx-064-TypicalVergeDetail-01.pdf | BHX | other | draft | 40 | 1 | 1cda176dfe4cb0ec | 2026-04-12T00:22:34.851832+00:00 | `934fbaaa-ad8f-40af-a3f1-53c3c832da97` |

### 343 — mixed-type

Key: `2010ashdxx067spinebeamdetail01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-067-SpineBeamDetail-01.pdf | BHX | asset_management | draft | 40 | 1 | 8e6187fe0ab4203a | 2026-04-12T10:14:08.396661+00:00 | `3fa75f58-5042-4e03-8f61-48428cf66a01` |
| 2 | 2010-A-SH-D-xx-067-SpineBeamDetail-01.pdf | BHX | other | draft | 40 | 3 | 39c7be881b7a6a5c | 2026-04-12T00:24:10.148383+00:00 | `6c9b06f7-ffb9-44d8-abef-a18e532a50df` |

### 344 — mixed-type

Key: `2010ashdxx068spinebeamdetail02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-068-SpineBeamDetail-02.pdf | BHX | other | draft | 40 | 1 | a6287645b63fd055 | 2026-04-12T00:23:42.914722+00:00 | `a2c650fd-f393-4a5e-b44c-656ec37b3883` |
| 2 | 2010-A-SH-D-xx-068-SpineBeamDetail-02.pdf | BHX | other | draft | 40 | 1 | 0713b7c1a661a944 | 2026-04-12T10:14:24.414199+00:00 | `d9beae16-4745-41ec-a065-2edc5dc11bd0` |

### 345 — mixed-type

Key: `2010ashdxx071canopydetails02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-071-CanopyDetails-02.pdf | BHX | other | draft | 40 | 1 | 93473bb9cfba1ef1 | 2026-04-12T00:25:49.487537+00:00 | `11cdb336-21ff-4810-82c5-0650ce392ad0` |
| 2 | 2010-A-SH-D-xx-071-CanopyDetails-02.pdf | BHX | other | draft | 40 | 2 | f36bf08b0f08dda7 | 2026-04-12T10:15:31.205461+00:00 | `50268d09-175e-49d4-acca-e6b597077ac5` |

### 346 — mixed-type

Key: `2010ashdxx072canopydetails03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-072-CanopyDetails-03.pdf | BHX | other | draft | 40 | 1 | 6859d5cf8c99a6e3 | 2026-04-12T10:16:18.672425+00:00 | `c058f822-7f6e-4577-9883-ca0e4aabc84b` |
| 2 | 2010-A-SH-D-xx-072-CanopyDetails-03.pdf | BHX | other | draft | 40 | 1 | 227dc77447024edd | 2026-04-12T00:25:30.533379+00:00 | `c662be4f-5c28-4c7a-91fe-f2a0795d4e2f` |

### 347 — mixed-type

Key: `2010ashdxx074entranceroof01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-074-EntranceRoof-01.pdf | BHX | other | draft | 40 | 1 | 9f54d1afa617d267 | 2026-04-12T10:16:05.152871+00:00 | `a69df8ea-0a8f-4706-9ff7-28f76b30a33d` |
| 2 | 2010-A-SH-D-xx-074-EntranceRoof-01.pdf | BHX | other | draft | 40 | 1 | 01e1a3e9a94dfc57 | 2026-04-12T00:25:02.954112+00:00 | `e022adff-e503-4458-a180-1fc54c8b9095` |

### 348 — mixed-type

Key: `2010ashdxx080curtainwallingglazingdetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-080-CurtainWalling-GlazingDetails-01.pdf | BHX | other | draft | 40 | 1 | 61636576bc5d0079 | 2026-04-12T00:27:03.511946+00:00 | `4abcca9a-9aa7-435a-8947-cfd312f6b76f` |
| 2 | 2010-A-SH-D-xx-080-CurtainWalling-GlazingDetails-01.pdf | BHX | other | draft | 40 | 1 | 2a37105680016e01 | 2026-04-12T10:15:47.426581+00:00 | `953eff4f-2a16-4535-a936-720d3d77a6dd` |

### 349 — mixed-type

Key: `2010ashdxx081curtainwallingglazingdetails02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-081-CurtainWalling-GlazingDetails-02.pdf | BHX | general | working_paper | 40 | 3 | d468a438184d89ab | 2026-04-12T00:26:49.93656+00:00 | `0d362ee2-0439-4731-9be6-d2e322d4ec82` |
| 2 | 2010-A-SH-D-xx-081-CurtainWalling-GlazingDetails-02.pdf | BHX | other | draft | 40 | 2 | 623a43bbfe702c02 | 2026-04-12T10:16:03.353181+00:00 | `f5046c02-b6b7-4242-ac06-59f5c0f5d3a6` |

### 350 — mixed-type

Key: `2010ashdxx082curtainwallingglazingdetails03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-082-CurtainWalling-GlazingDetails-03.pdf | BHX | other | draft | 40 | 1 | 9aab4997de5fc463 | 2026-04-12T10:16:39.474757+00:00 | `303ec417-f11f-4f59-8783-b1946d9e3a6e` |
| 2 | 2010-A-SH-D-xx-082-CurtainWalling-GlazingDetails-03.pdf | BHX | other | draft | 40 | 1 | 00b4d391a9e216fa | 2026-04-12T00:26:17.81488+00:00 | `5a966f9b-9a54-46dd-a8ee-554feba2a556` |

### 351 — mixed-type

Key: `2010ashdxx085curtainwallingdoordetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-085-CurtainWalling-DoorDetails-01.pdf | BHX | other | draft | 40 | 1 | 0700f5196b01a04b | 2026-04-12T00:28:23.00655+00:00 | `eb72cedc-1bd2-4e41-aed6-1851f0dd064c` |
| 2 | 2010-A-SH-D-xx-085-CurtainWalling-DoorDetails-01.pdf | BHX | other | draft | 40 | 1 | 335fa29af192eb89 | 2026-04-12T10:17:14.169565+00:00 | `f37f32dc-0032-4869-a850-2fd24554364e` |

### 352 — mixed-type

Key: `2010ashdxx086curtainwallingdoordetails02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-086-CurtainWalling-DoorDetails-02.pdf | BHX | other | draft | 40 | 2 | b23d94682ef479dd | 2026-04-12T10:16:46.039457+00:00 | `85cd7ee9-4d36-4980-851a-73f59d1dc82b` |
| 2 | 2010-A-SH-D-xx-086-CurtainWalling-DoorDetails-02.pdf | BHX | other | draft | 40 | 2 | 482e6d42d2be37b7 | 2026-04-12T00:28:09.631603+00:00 | `88fd53a7-058a-404a-9ca0-da1ef82d2553` |

### 353 — mixed-type

Key: `2010ashdxx091entrancedoorglazingdetails03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-091-EntranceDoor&GlazingDetails-03.pdf | BHX | other | draft | 40 | 1 | 7856cae1065757dc | 2026-04-12T10:17:48.877389+00:00 | `55755a6d-0130-4f14-8f56-c4fd6c3c5ada` |
| 2 | 2010-A-SH-D-xx-091-EntranceDoor&GlazingDetails-03.pdf | BHX | other | draft | 40 | 1 | 5298c2f3388f1ed5 | 2026-04-12T00:28:36.369921+00:00 | `8006011d-9df2-45e0-a638-1495e8bc84d3` |

### 354 — mixed-type

Key: `2010ashdxx093windowdetailscontroltower01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-093-WindowDetails-ControlTower-01.pdf | BHX | other | draft | 40 | 1 | c84e392690c366f3 | 2026-04-12T10:18:38.271886+00:00 | `44b5907f-76cf-488e-b9cb-ec8dd2bf9b7c` |
| 2 | 2010-A-SH-D-xx-093-WindowDetails-ControlTower-01.pdf | BHX | other | draft | 40 | 1 | 0901b8d5005bd5c5 | 2026-04-12T00:29:52.868669+00:00 | `c1e921ac-8f3a-4cfd-81e6-e1bed1e305e9` |

### 355 — mixed-type

Key: `2010ashdxx094windowdetailscontroltower02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-094-WindowDetails-ControlTower-02.pdf | BHX | other | draft | 40 | 2 | c18401631888730c | 2026-04-12T00:29:39.305416+00:00 | `275a57af-e936-429c-bac5-144da38336b9` |
| 2 | 2010-A-SH-D-xx-094-WindowDetails-ControlTower-02.pdf | BHX | other | draft | 40 | 1 | cc501d51094340a3 | 2026-04-12T10:18:24.397898+00:00 | `fe79c665-afa9-4396-85f7-82106bb64575` |

### 356 — mixed-type

Key: `2010ashdxx100typicalpartitionsections|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-100-TypicalPartitionSections.pdf | BHX | other | draft | 40 | 1 | 75d36a8734ed1c43 | 2026-04-12T10:17:58.548137+00:00 | `3c62213b-0f31-43ad-a487-ec3f774c5ac7` |
| 2 | 2010-A-SH-D-xx-100-TypicalPartitionSections.pdf | BHX | other | draft | 40 | 1 | 49e4d4c4dc891494 | 2026-04-12T00:31:12.275201+00:00 | `ce617b0e-f704-4e31-a8cc-ece62a14261d` |

### 357 — mixed-type

Key: `2010ashdxx106partitionsections02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-106-PartitionSections-02.pdf | BHX | other | unknown | 40 | 4 | 9f1e75e45998683c | 2026-04-12T00:30:39.781677+00:00 | `1932b9e2-f89f-4a9a-b25b-c674cc6376ad` |
| 2 | 2010-A-SH-D-xx-106-PartitionSections-02.pdf | BHX | other | unknown | 40 | 4 | 0b443175bbc2b9e8 | 2026-04-12T10:19:01.963542+00:00 | `cb701b9d-7e4b-4848-a29b-b657b9b5543a` |

### 358 — mixed-type

Key: `2010ashdxx107partitionsections03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-107-PartitionSections-03.pdf | BHX | other | unknown | 40 | 4 | 92526969327bb173 | 2026-04-12T10:19:55.502831+00:00 | `914f42c7-5a71-4c46-84d4-7ec540df8930` |
| 2 | 2010-A-SH-D-xx-107-PartitionSections-03.pdf | BHX | other | unknown | 40 | 4 | adf3ba09c4b00af9 | 2026-04-12T00:31:25.534398+00:00 | `e0412e77-c2c9-4445-b74e-7cf4eb507d6e` |

### 359 — mixed-type

Key: `2010ashdxx108partitionsections04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-108-PartitionSections-04.pdf | BHX | other | draft | 40 | 3 | b7cc05c3cd16d91b | 2026-04-12T10:19:39.844917+00:00 | `347aef9d-a10e-4732-992f-1ba23cd1944c` |
| 2 | 2010-A-SH-D-xx-108-PartitionSections-04.pdf | BHX | other | working_paper | 40 | 3 | 3e4aa51e92be28bb | 2026-04-12T00:32:20.083556+00:00 | `ce352540-fb9c-4d7e-8997-efa624c0b17d` |

### 360 — mixed-type

Key: `2010ashdxx109partitionsections05|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-109-PartitionSections-05.pdf | BHX | other | draft | 40 | 2 | 549f5911454d5241 | 2026-04-12T10:19:08.707159+00:00 | `6be1ee33-b9a9-4edc-84b8-774c03d0633e` |
| 2 | 2010-A-SH-D-xx-109-PartitionSections-05.pdf | BHX | other | draft | 40 | 2 | 4b8c6cc88e21728c | 2026-04-12T00:32:06.572873+00:00 | `7b50ea95-46de-4052-9499-199c29dd73d3` |

### 361 — mixed-type

Key: `2010ashdxx115partitionplans01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-115-PartitionPlans-01.pdf | BHX | other | draft | 40 | 1 | 9be601e442a4f567 | 2026-04-12T10:19:19.877521+00:00 | `1c23f55a-f2b7-44bb-bc1b-e3fb9b768c2b` |
| 2 | 2010-A-SH-D-xx-115-PartitionPlans-01.pdf | BHX | other | draft | 40 | 1 | 4214247dd829fc9e | 2026-04-12T00:31:39.982645+00:00 | `7401c741-dcd7-4e62-99c2-a68d8a264afb` |

### 362 — mixed-type

Key: `2010ashdxx117partitionplans03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-117-PartitionPlans-03.pdf | BHX | other | draft | 40 | 1 | bfe500437d091a76 | 2026-04-12T10:20:20.36034+00:00 | `b2eb3fc2-f2fb-4675-a619-3ae89d685b36` |
| 2 | 2010-A-SH-D-xx-117-PartitionPlans-03.pdf | BHX | other | draft | 40 | 1 | f9f1da62f02b0af8 | 2026-04-12T00:32:33.233728+00:00 | `cef927b0-677f-4860-8166-022b60d74173` |

### 363 — mixed-type

Key: `2010ashdxx119partitionplans05|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-119-PartitionPlans-05.pdf | BHX | other | draft | 40 | 1 | 54e4c5a38fe19355 | 2026-04-12T10:20:54.05647+00:00 | `b8da825c-71a6-4759-bf30-261f10ee834e` |
| 2 | 2010-A-SH-D-xx-119-PartitionPlans-05.pdf | BHX | other | draft | 40 | 1 | d7cf36265ee547ed | 2026-04-12T00:33:14.095213+00:00 | `bc8622b9-ff44-4031-9f3d-a015f4b13c4a` |

### 364 — mixed-type

Key: `2010ashdxx135upperfloordetails|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-135-UpperFloorDetails.pdf | BHX | other | draft | 40 | 1 | 007f187883e23cce | 2026-04-12T00:33:55.604302+00:00 | `2dbe3517-72a5-4746-9489-69cf400ff7e5` |
| 2 | 2010-A-SH-D-xx-135-UpperFloorDetails.pdf | BHX | other | draft | 40 | 1 | f31fa4e9663fb9ee | 2026-04-12T10:20:54.365388+00:00 | `474c4cd1-30d5-4082-9522-2a1c8a66e71d` |

### 365 — mixed-type

Key: `2010ashdxx150stair01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-150-Stair-01.pdf | BHX | other | draft | 40 | 1 | 014357ef41101fb9 | 2026-04-12T00:35:47.253018+00:00 | `1ebe1cca-afea-46b5-9f7b-9c3c4df055bc` |
| 2 | 2010-A-SH-D-xx-150-Stair-01.pdf | BHX | other | draft | 40 | 1 | 8d2a63d12c7762b4 | 2026-04-12T10:21:26.395468+00:00 | `a97801bf-4e4d-4706-b8eb-dbc3c24c5bfa` |

### 366 — mixed-type

Key: `2010ashdxx151stair02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-151-Stair-02.pdf | BHX | other | draft | 40 | 1 | 58bec2d45d465d7b | 2026-04-12T10:22:51.710496+00:00 | `a8e0487c-3fba-4c91-b7f0-260222929138` |
| 2 | 2010-A-SH-D-xx-151-Stair-02.pdf | BHX | other | draft | 40 | 1 | bf4b4f84b950f49c | 2026-04-12T00:35:09.227822+00:00 | `c0157bff-341f-4a8d-9d02-24fc7b0d19b4` |

### 367 — mixed-type

Key: `2010ashdxx152stair03|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-152-Stair-03.pdf | BHX | other | draft | 40 | 2 | 2ebea2cf0e6cd11c | 2026-04-12T10:22:02.582325+00:00 | `0106feea-fa29-42a1-9ad5-f355cd85e3e7` |
| 2 | 2010-A-SH-D-xx-152-Stair-03.pdf | BHX | other | draft | 40 | 1 | 4b89635d97f3bcc8 | 2026-04-12T00:35:33.663112+00:00 | `621f7066-a82c-41b0-ad14-e6462314bf75` |
| 3 | 2010-A-SH-D-xx-152-Stair-03.pdf | BHX | other | draft | 40 | 1 | 8dbf5fa2b473b778 | 2026-04-12T10:22:15.959321+00:00 | `d4a5bf5f-b6a4-4186-b841-9650b923146d` |

### 368 — mixed-type

Key: `2010ashdxx153stair04|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-153-Stair-04.pdf | BHX | other | draft | 40 | 2 | 9dbe7924c58fc7ad | 2026-04-12T00:36:20.219961+00:00 | `7f412141-12d7-4ecb-9530-b557ab14dbd0` |
| 2 | 2010-A-SH-D-xx-153-Stair-04.pdf | BHX | other | draft | 40 | 2 | 8cfe502b15861324 | 2026-04-12T10:21:33.441651+00:00 | `a2bd5b05-5be1-45ed-aba1-dd5b9ee2f751` |

### 369 — mixed-type

Key: `2010ashdxx200externalplantenclosuredetails01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-200-ExternalPlantEnclosureDetails-01.pdf | BHX | other | draft | 40 | 1 | f1d45802353c156d | 2026-04-12T10:21:42.494599+00:00 | `ade3dd30-32c2-4880-9534-4e61afa057ff` |
| 2 | 2010-A-SH-D-xx-200-ExternalPlantEnclosureDetails-01.pdf | BHX | other | draft | 40 | 1 | 8cdcb46823e8fbf5 | 2026-04-12T00:36:34.743075+00:00 | `b0b56bb6-40a3-44ff-82c6-31fa053dbcbf` |
| 3 | 2010-A-SH-D-xx-200-ExternalPlantEnclosureDetails-01.pdf | BHX | other | draft | 40 | 1 | f7df41010e07a3ad | 2026-04-12T10:21:47.359677+00:00 | `dc4ba177-1815-4ed3-b30f-703af526296a` |

### 370 — mixed-type

Key: `2010ashdxx201externalplantenclosuredetails02|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-201-ExternalPlantEnclosureDetails-02.pdf | BHX | other | draft | 40 | 2 | edbb63f4dc6e16ac | 2026-04-12T10:21:56.228815+00:00 | `5b8c69cc-9516-4b46-9ea4-39dffadab148` |
| 2 | 2010-A-SH-D-xx-201-ExternalPlantEnclosureDetails-02.pdf | BHX | other | draft | 40 | 2 | 3c57e492e39e0315 | 2026-04-12T00:36:48.148806+00:00 | `b7eec82a-6ea3-450b-9e41-576adbe6c869` |

### 371 — mixed-type

Key: `2010ashdxx202substationenclosuredetails|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-D-xx-202-SubstationEnclosureDetails.pdf | BHX | other | draft | 40 | 2 | 3292c94da1762e20 | 2026-04-12T00:37:51.087635+00:00 | `152da6fe-2268-4db4-9e02-4508df971666` |
| 2 | 2010-A-SH-D-xx-202-SubstationEnclosureDetails.pdf | BHX | other | draft | 40 | 3 | 7cd4b2cf1acab4ca | 2026-04-12T10:23:10.719792+00:00 | `646572fb-ed37-483a-a600-e6fd77d07ff4` |

### 372 — mixed-type

Key: `2010ashexx210northelevation12|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-210-NorthElevation 1_2.pdf | BHX | other | draft | 40 | 1 | 62276348d1ac7cfe | 2026-04-12T08:50:35.684843+00:00 | `3b24ee1a-e11d-487a-9094-c3f766ca5c54` |
| 2 | 2010-A-SH-E-xx-210-NorthElevation 1_2.pdf | BHX | other | draft | 40 | 2 | 4784b664847c78c9 | 2026-04-12T01:48:33.908686+00:00 | `5a858f0e-0e0f-468a-8302-8df10262ff04` |

### 373 — mixed-type

Key: `2010ashexx211northelevation22|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-211-NorthElevation 2_2.pdf | BHX | other | draft | 40 | 1 | bc704077ee47b835 | 2026-04-12T01:47:55.556388+00:00 | `05c680c5-1bce-45ce-b4b3-a61f041632a6` |
| 2 | 2010-A-SH-E-xx-211-NorthElevation 2_2.pdf | BHX | other | draft | 40 | 2 | 12052d442ac48d72 | 2026-04-12T08:50:54.168541+00:00 | `a104d630-a99b-4fd2-a4c0-d44f76a6146c` |

### 374 — mixed-type

Key: `2010ashexx212southelevation12|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-212-SouthElevation 1_2.pdf | BHX | asset_management | draft | 40 | 1 | 742bc9ac9e56bdaf | 2026-04-12T08:52:01.90339+00:00 | `0b92b7c1-e926-4c2a-ac5d-ed5b41fae39f` |
| 2 | 2010-A-SH-E-xx-212-SouthElevation 1_2.pdf | BHX | other | draft | 40 | 1 | 64c7596b2dff60dc | 2026-04-12T01:48:14.92687+00:00 | `9526be19-a768-4375-b4da-36e5801cd235` |

### 375 — mixed-type

Key: `2010ashexx213southelevation22|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-213-SouthElevation 2_2.pdf | BHX | other | draft | 40 | 2 | cc7c89ee1a5a736a | 2026-04-12T08:52:28.162088+00:00 | `6a82e751-d1cc-4a3b-971e-95f155e20018` |
| 2 | 2010-A-SH-E-xx-213-SouthElevation 2_2.pdf | BHX | asset_management | draft | 40 | 1 | 180e9669dc684cb8 | 2026-04-12T01:49:02.51141+00:00 | `d097d9cc-8632-4a19-ab8f-80b9be91d969` |

### 376 — mixed-type

Key: `2010ashexx214eastwestelevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-214-EastWestElevations.pdf | BHX | other | draft | 40 | 1 | f660c2d04914c62a | 2026-04-12T08:51:55.754948+00:00 | `1884f726-284b-4aa9-ad12-c78e1f5c5589` |
| 2 | 2010-A-SH-E-xx-214-EastWestElevations.pdf | BHX | other | draft | 40 | 1 | c0dcf31df0df1888 | 2026-04-12T01:49:44.436432+00:00 | `229db1aa-e53a-48b6-ab10-792eb9676c88` |

### 377 — mixed-type

Key: `2010ashexx222substationelevations|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-E-xx-222-SubstationElevations.pdf | BHX | other | draft | 40 | 1 | a7235f34be4b9530 | 2026-04-12T01:50:07.17114+00:00 | `37ad5aa6-9f80-4b23-a463-7de9d55b5403` |
| 2 | 2010-A-SH-E-xx-222-SubstationElevations.pdf | BHX | other | draft | 40 | 1 | 98dd331274fbe9d2 | 2026-04-12T08:52:15.871175+00:00 | `5a2f09bc-fcf4-4b4e-9a50-b0aa9668d09a` |

### 378 — mixed-type

Key: `2010ashp00112groundfloorplan12|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-112-GroundFloorPlan-1_2.pdf | BHX | other | draft | 40 | 2 | c66f29a2a6f06dc2 | 2026-04-12T09:08:09.418921+00:00 | `85d1ba6a-ed3c-41d5-a6f0-a6dada662ddd` |
| 2 | 2010-A-SH-P-00-112-GroundFloorPlan-1_2.pdf | BHX | asset_management | executed | 40 | 3 | fac478b1b24dfaf3 | 2026-04-12T01:52:04.685713+00:00 | `8f615730-b222-428d-9a0c-3b9a7da7e147` |

### 379 — mixed-type

Key: `2010ashp00130detailgroundfloorplan15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-130-DetailGroundFloorPlan-1_5.pdf | BHX | other | draft | 40 | 7 | 175bb84f1592b426 | 2026-04-12T02:22:04.57181+00:00 | `c158817d-be60-4478-ab21-cd79afdab2d5` |
| 2 | 2010-A-SH-P-00-130-DetailGroundFloorPlan-1_5.pdf | BHX | other | draft | 40 | 2 | b369c570000f83e2 | 2026-04-12T08:53:14.666546+00:00 | `ffd7d77e-ea03-4e82-bc9d-5ea2a1b74a25` |

### 380 — mixed-type

Key: `2010ashp00150gfbuildups15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-150-GFBuildups-1_5.pdf | BHX | other | draft | 40 | 1 | 9f14df139ff0735c | 2026-04-12T02:41:07.412491+00:00 | `659889a7-29e5-4a2e-a04d-e63bbd17321d` |
| 2 | 2010-A-SH-P-00-150-GFBuildups-1_5.pdf | BHX | other | draft | 40 | 1 | 26dbc1846582d3ef | 2026-04-12T09:09:12.07567+00:00 | `926141cb-4d7d-4b88-a645-6d7f55442183` |

### 381 — mixed-type

Key: `2010ashp00152gfbuildups35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-152-GFBuildups-3_5.pdf | BHX | other | draft | 40 | 1 | f3b2362c40d13804 | 2026-04-12T09:08:52.802483+00:00 | `3933ff7e-e88e-45a1-b59b-b298d4c56a2f` |
| 2 | 2010-A-SH-P-00-152-GFBuildups-3_5.pdf | BHX | other | draft | 40 | 2 | c6c1631cc8c63250 | 2026-04-12T02:42:05.672144+00:00 | `5d2142fe-7f8e-4f2e-b515-cadc208eed81` |

### 382 — mixed-type

Key: `2010ashp00171reflectedceilingplan25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-171-ReflectedCeilingPlan-2_5.pdf | BHX | other | executed | 40 | 2 | d42069f67dba0473 | 2026-04-12T02:44:07.034162+00:00 | `2dfbffaf-9745-47ec-ba98-e1186e3d05cb` |
| 2 | 2010-A-SH-P-00-171-ReflectedCeilingPlan-2_5.pdf | BHX | other | draft | 40 | 2 | 597581ba5bf09133 | 2026-04-12T09:21:12.616957+00:00 | `80ef93ac-84e8-474e-861e-a60bd6dfbf30` |

### 383 — mixed-type

Key: `2010ashp00173reflectedceilingplan45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-173-ReflectedCeilingPlan-4_5.pdf | BHX | other | draft | 40 | 2 | b87bbb07b093f83f | 2026-04-12T02:43:04.197409+00:00 | `772a9acf-24c6-4099-9375-876f1aba1c76` |
| 2 | 2010-A-SH-P-00-173-ReflectedCeilingPlan-4_5.pdf | BHX | other | draft | 40 | 2 | 53779d0a2cda626f | 2026-04-12T09:21:08.004751+00:00 | `e4406b42-ca58-4135-9874-1ed925370150` |

### 384 — mixed-type

Key: `2010ashp00174reflectedceilingplan55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-174-ReflectedCeilingPlan-5_5.pdf | BHX | other | draft | 40 | 3 | 8ec98fa386f7b07f | 2026-04-12T09:21:32.4695+00:00 | `035ba50a-c1cf-43d8-ba98-bcadcca34265` |
| 2 | 2010-A-SH-P-00-174-ReflectedCeilingPlan-5_5.pdf | BHX | other | working_paper | 40 | 3 | dd36d8e19aec10bc | 2026-04-12T02:43:28.864969+00:00 | `63165b48-9237-4747-b8cf-91c86943a82b` |

### 385 — mixed-type

Key: `2010ashp00180gffinishes15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-180-GFFinishes-1_5.pdf | BHX | other | draft | 40 | 1 | 35fbde6dd1058c7d | 2026-04-12T02:44:26.341782+00:00 | `67abede5-349a-4d90-8c42-84084d5feca5` |
| 2 | 2010-A-SH-P-00-180-GFFinishes-1_5.pdf | BHX | other | draft | 40 | 1 | f8a4156bedecc9dd | 2026-04-12T09:22:12.39481+00:00 | `96ea135d-7822-4031-aa82-faee4d1b07fc` |

### 386 — mixed-type

Key: `2010ashp00183gffinishes45|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-183-GFFinishes-4_5.pdf | BHX | other | draft | 40 | 1 | 175516b1cdb372e3 | 2026-04-12T02:44:40.95178+00:00 | `37291380-371c-493d-a5ff-ee7dce18ec9f` |
| 2 | 2010-A-SH-P-00-183-GFFinishes-4_5.pdf | BHX | other | draft | 40 | 1 | 56ddbab937da1a4f | 2026-04-12T09:22:18.209841+00:00 | `536d7ae1-a9de-4ee4-9910-103b836b6c70` |

### 387 — mixed-type

Key: `2010ashp00420gfdrainage15|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-420-GF-Drainage-1_5.pdf | BHX | other | draft | 40 | 1 | c1163bc147b95053 | 2026-04-12T09:22:46.175486+00:00 | `065af70b-e1f7-480e-9bf4-1f9385b178a9` |
| 2 | 2010-A-SH-P-00-420-GF-Drainage-1_5.pdf | BHX | other | draft | 40 | 1 | 15897ccbf874af3c | 2026-04-12T02:46:37.130423+00:00 | `f4ad5381-6387-40c0-bacc-d15abd1e8b69` |

### 388 — mixed-type

Key: `2010ashp00421gfdrainage25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-421-GF-Drainage-2_5.pdf | BHX | other | draft | 40 | 1 | 10de4bdb952fe73d | 2026-04-12T02:46:08.32277+00:00 | `4f00398b-4f0b-4d7d-b5f0-bdb569a73e70` |
| 2 | 2010-A-SH-P-00-421-GF-Drainage-2_5.pdf | BHX | other | draft | 40 | 1 | b4a2269a6bdb0ae6 | 2026-04-12T09:23:32.186129+00:00 | `d49ab62c-6960-47b3-9801-df503d06f9a8` |

### 389 — mixed-type

Key: `2010ashp00422gfdrainage35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-00-422-GF-Drainage-3_5.pdf | BHX | other | draft | 40 | 1 | 84c8647ed288c22d | 2026-04-12T09:24:27.132862+00:00 | `6df93754-265a-4ca1-9f89-afa2071e3143` |
| 2 | 2010-A-SH-P-00-422-GF-Drainage-3_5.pdf | BHX | other | draft | 40 | 1 | 513663b5155db85a | 2026-04-12T02:46:22.248661+00:00 | `7eab0065-e500-4db9-a257-e7a4251b0b6b` |
| 3 | 2010-A-SH-P-00-422-GF-Drainage-3_5.pdf | BHX | other | draft | 40 | 1 | d1a5bb73afd30481 | 2026-04-12T09:24:27.780013+00:00 | `a633a126-b38f-4617-b2b2-f12d64b8acd0` |

### 390 — mixed-type

Key: `2010ashp01138detailfirstfloorplan01|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-138-DetailFirstFloorPlan-01.pdf | BHX | other | draft | 40 | 1 | efcfefb202d21707 | 2026-04-12T09:23:46.750543+00:00 | `4894bfa3-6952-4456-94f5-14c33c900c18` |
| 2 | 2010-A-SH-P-01-138-DetailFirstFloorPlan-01.pdf | BHX | other | draft | 40 | 2 | feb9bc4f63c047b7 | 2026-04-12T03:08:51.308919+00:00 | `622c2262-b446-4530-9f9d-b776b4095dc9` |

### 391 — mixed-type

Key: `2010ashp01161ffbuildups25|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-161-FFBuildups-2_5.pdf | BHX | other | draft | 40 | 1 | 2dd2317f622f5835 | 2026-04-12T02:58:24.285276+00:00 | `6172c352-77d4-44de-bacc-f97c3fd00c37` |
| 2 | 2010-A-SH-P-01-161-FFBuildups-2_5.pdf | BHX | other | draft | 40 | 1 | 1aa605e92119fc39 | 2026-04-12T09:24:40.812873+00:00 | `b9670f93-5a2d-4e92-87f3-fe22e604fdbb` |

### 392 — mixed-type

Key: `2010ashp01178reflectedceilingplan11|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-178-ReflectedCeilingPlan-1_1.pdf | BHX | other | draft | 40 | 2 | 4a7395f5b974a370 | 2026-04-12T09:25:00.988353+00:00 | `1102e004-9f1a-4f2b-8cfc-bcdebe868802` |
| 2 | 2010-A-SH-P-01-178-ReflectedCeilingPlan-1_1.pdf | BHX | other | draft | 40 | 2 | 3d7679811c1b1084 | 2026-04-12T03:19:29.617876+00:00 | `9af798a6-019d-4f6c-b6ad-c3b11163c7e6` |

### 393 — mixed-type

Key: `2010ashp01188fffinishes|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-01-188-FFFinishes.pdf | BHX | other | draft | 40 | 1 | c0aa540a9de6098c | 2026-04-12T09:25:14.757317+00:00 | `4e201a14-b87c-4060-814d-c095b3b6a4e5` |
| 2 | 2010-A-SH-P-01-188-FFFinishes.pdf | BHX | other | draft | 40 | 2 | 8a40a6839b23aabf | 2026-04-12T03:09:26.359574+00:00 | `b8cb8b2a-458c-49d5-a84e-309dd0e57cfe` |

### 394 — mixed-type

Key: `2010ashprf142detailroofplan35|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-RF-142-DetailRoofPlan-3_5.pdf | BHX | other | executed | 40 | 1 | 74eb2d447e4cd249 | 2026-04-12T03:20:17.367596+00:00 | `4be089ed-f1c4-43a2-847f-8b33c32ba4dc` |
| 2 | 2010-A-SH-P-RF-142-DetailRoofPlan-3_5.pdf | BHX | other | draft | 40 | 1 | b6e01fc13dc0a469 | 2026-04-12T09:27:17.125614+00:00 | `566c2a0d-bda8-48b2-94c0-bd63be2a864d` |

### 395 — mixed-type

Key: `2010ashprf144detailroofplan55|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-SH-P-RF-144-DetailRoofPlan-5_5.pdf | BHX | other | draft | 40 | 2 | 0430d72477874dec | 2026-04-12T09:26:25.198303+00:00 | `9137aa55-8b75-4140-902a-cf5f8ce1301a` |
| 2 | 2010-A-SH-P-RF-144-DetailRoofPlan-5_5.pdf | BHX | other | draft | 40 | 2 | 0708676ee3c00bdf | 2026-04-12T03:21:48.68958+00:00 | `eb37ab94-7c24-4f58-af6a-7916ff1cb93d` |

### 396 — mixed-type

Key: `2010asitepxx100locationplan|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 2010-A-Site-P-xx-100-LocationPlan.pdf | BHX | general | draft | 40 | 1 | 9c92f7db0a2c4ce3 | 2026-04-12T09:38:23.359518+00:00 | `bd6626e6-a5a7-4467-a4cb-3fbf6fe0061a` |
| 2 | 2010-A-Site-P-xx-100-LocationPlan.pdf | BHX | other | draft | 40 | 1 | 74bdf2f468162da0 | 2026-04-12T01:39:53.62512+00:00 | `fd345bb9-ab51-41c6-bf30-67b766cc2cdb` |

### 397 — mixed-type

Key: `301gla00xxdrl1206plantingplanarea3of7|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 301_GLA_00_XX_DR_L_1206 Planting Plan - Area 3 of 7.pdf | BHX | other | working_paper | 40 | 2 | ef156c2cccb8af35 | 2026-04-12T11:02:39.660193+00:00 | `407c4784-93dd-48a9-bfde-93c48fca8a8b` |
| 2 | 301_GLA_00_XX_DR_L_1206 Planting Plan - Area 3 of 7.pdf | BHX | other | working_paper | 40 | 122 | 582db0b8d7edef75 | 2026-04-12T11:02:41.464494+00:00 | `4f7856de-6556-42d8-997b-abfdb9975143` |

### 398 — mixed-type

Key: `301gla00xxdrl3512t1sectionll|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 301_GLA_00_XX_DR_L_3512_T1 Section LL.pdf | BHX | other | executed | 40 | 2 | 69ba4fb8a3ba85ef | 2026-04-12T11:06:23.516839+00:00 | `290772ea-835b-48cf-954e-f762ff0eea29` |
| 2 | 301_GLA_00_XX_DR_L_3512_T1 Section LL.pdf | BHX | other | signed | 40 | 2 | 589502e21a9831f2 | 2026-04-12T11:06:34.689909+00:00 | `aaadf4ed-cbd5-4cf8-9985-13ff190028e1` |

### 399 — mixed-type

Key: `301glaxxxxshl6001drawingissuesheet|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 301_GLA_XX_XX_SH_L_6001 Drawing Issue Sheet.pdf | BHX | other | draft | 40 | 3 | df086d8f8ceaab85 | 2026-04-12T11:08:26.413749+00:00 | `4cc0aaff-a863-4fc8-9dad-6a14fc35dd5b` |
| 2 | 301_GLA_XX_XX_SH_L_6001 Drawing Issue Sheet.pdf | BHX | asset_management | working_paper | 40 | 3 | 4abadd99064998e1 | 2026-04-12T03:59:27.43548+00:00 | `6bf3d748-8081-4885-be2c-343501dd85cf` |

### 400 — mixed-type

Key: `cartabirminghamf|BHX`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | carta Birmingham F.docx | BHX | correspondence | signed | 90 | 5 | 165c74c543c52394 | 2026-04-11T17:18:12.566728+00:00 | `1434f3d3-07d2-4184-959f-5f927f46191b` |
| 2 | carta Birmingham F.pdf | BHX | correspondence | signed | 90 | 5 | f7b1fedcac0d21b8 | 2026-04-11T17:18:26.510406+00:00 | `852b99d7-e457-4a0c-802c-022fb773bfcf` |

### 401 — mixed-type

Key: `ficheroescaneadomfplexmark27012025|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | fichero_escaneado_MFP_Lexmark27-01-2025-121826.pdf | MAD | bank_statement | unknown | 90 | 12 | 685e7a854b9c6f84 | 2026-04-12T11:11:50.042381+00:00 | `c59714fd-191d-4e7b-8a9e-1e68748d22b3` |
| 2 | fichero_escaneado_MFP_Lexmark27-01-2025-121826 signed.pdf | MAD | bank_statement | executed | 90 | 12 | b0dcc3c309b6a882 | 2026-04-12T11:11:18.622974+00:00 | `c8f4eacb-efc2-48fd-b820-33604a59ced1` |

### 402 — mixed-type

Key: `gemswellbrandmanualv7|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Brand Manual_V7.pdf | PHILAE | general | executed | 40 | 5 | abcb760b9e26be04 | 2026-04-12T12:45:02.350756+00:00 | `26285f2b-65a2-470f-a533-2878f7a4c24b` |
| 2 | Gemswell Brand Manual_V7.pdf | PHILAE | general | executed | 40 | 7 | a5d890ca0029d0d2 | 2026-04-12T12:44:57.052712+00:00 | `9eab2244-db22-4615-9db8-8d43308a6888` |

### 403 — mixed-type

Key: `madpsarcrepasodeoperacionycirculaciones|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MAD-PS-ARC-Repaso de Operacion y circulaciones 20241004.pdf | GVF | general | draft | 40 | 109 | 7674b98359b56283 | 2026-04-12T12:49:04.585323+00:00 | `0c308935-32df-4145-b224-0bd0add0deeb` |
| 2 | MAD-PS-ARC-Repaso de Operacion y circulaciones 20241004 (1).pdf | GVF | general | draft | 40 | 109 | b620953d838e68fe | 2026-04-12T12:48:50.626717+00:00 | `6b7a43de-f83a-4599-82ba-abe95616c568` |

### 404 — mixed-type

Key: `membershipdossier02cast|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Membership Dossier_02_Cast.pdf | PHILAE | general | executed | 10 | 15 | cbfca31b7409ce53 | 2026-04-12T12:45:59.939316+00:00 | `5f9f6a96-6db3-4431-aebd-32a7ac79bbdc` |
| 2 | Membership Dossier_02_Cast.pdf | PHILAE | general | executed | 10 | 20 | d49a901969895bfe | 2026-04-12T12:45:50.768763+00:00 | `e0eb75a7-ca36-4063-b2c5-d47c83fe9431` |

### 405 — mixed-type

Key: `membershipdossier02eng|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Membership Dossier_02_Eng.pdf | PHILAE | general | executed | 40 | 1 | 14e0d5499b2bad27 | 2026-04-12T12:46:13.915615+00:00 | `35f2656a-15bc-4489-b126-18b9bc754586` |
| 2 | Membership Dossier_02_Eng.pdf | PHILAE | general | executed | 10 | 16 | d6e9130f33281c9e | 2026-04-12T12:45:54.678937+00:00 | `de2595be-ae65-4532-a8d1-b295a98835ee` |

### 406 — mixed-type

Key: `structurechart|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Structure Chart.pdf | MAD | asset_management | unknown | 40 | 1 | a6c5626cfbd6607a | 2026-04-11T18:20:20.552834+00:00 | `7dd7c0b6-2171-439a-b5d1-a0b17ef1f670` |
| 2 | Structure Chart.pdf | MAD | asset_management | unknown | 40 | 1 | 1cfdf28877f3c3de | 2026-04-11T20:11:13.70363+00:00 | `b4c08c4f-b825-487a-8fa9-a12e66817ee6` |

### 407 — mixed-type

Key: `wavesamaespconsolidadolimpiodef|MAD`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Waves - AMA (Esp) Consolidado (limpio) DEF.pdf | MAD | asset_management | unknown | 95 | 171 | 78e4cbdb23ca9669 | 2026-04-12T12:30:14.747155+00:00 | `25e08879-6ed5-4e61-a792-8c9cccb5ddf2` |
| 2 | Waves - AMA (Esp) Consolidado (limpio) DEF.docx | MAD | asset_management | unknown | 95 | 93 | a287fc101e364abe | 2026-04-12T12:29:57.301029+00:00 | `36d268b8-6317-49ae-9531-f1856943b8db` |

### 408 — mixed-type

Key: `westfieldmilanpptgeneralistic|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 241210_Westfield_Milan_PPT_Generalistic.pdf | GVF | general | unknown | 10 | 72 | ff18471386d30e8b | 2026-04-12T12:40:39.576859+00:00 | `7493bb12-812e-4d02-b37b-4ae4442ce58d` |
| 2 | 241210_Westfield_Milan_PPT_Generalistic.pdf | GVF | general | unknown | 10 | 52 | 4f990e91b8ccd45f | 2026-04-12T12:38:56.723543+00:00 | `8decbde3-fcec-4164-9c04-13f8cd5bbd58` |

### 409 — mixed-type

Key: `westfieldmilanpptgeneralistic|PHILAE`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 241210_Westfield_Milan_PPT_Generalistic.pdf | PHILAE | general | unknown | 10 | 57 | 6f7bd3777b3b04ce | 2026-04-12T12:12:13.190508+00:00 | `046ac8c0-c325-4fb9-b664-5a7d15e7a4ab` |
| 2 | 241210_Westfield_Milan_PPT_Generalistic.pdf | PHILAE | general | unknown | 10 | 72 | ff18471386d30e8b | 2026-04-12T12:11:40.166726+00:00 | `bffa70e9-4569-461d-8b99-fab62df8c3f9` |

### 410 — mixed-type

Key: `wgsurfopsopsniveleswaacademyes|GVF`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | WG Surf Ops 240130 OPS- Niveles WA Academy.es.docx | GVF | general | working_paper | 40 | 15 | bb966b117c7f2d01 | 2026-04-12T12:50:53.088717+00:00 | `22173be4-7e89-40ce-8dbf-ae81b2e4400b` |
| 2 | WG Surf Ops 240130 OPS- Niveles WA Academy.es.docx | GVF | general | working_paper | 40 | 5 | 942e87b69997772b | 2026-04-12T12:50:55.6332+00:00 | `3d4ff68f-7bbc-4356-b3b8-5960d39f6276` |

### 411 — sim 0.00 len 0.02

Key: `ammpsanexovii`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | AM_MPS-Anexo VII.pdf | MAD | legal | unknown | 95 | 4 | 717e048fe553cb09 | 2026-04-12T12:25:42.360172+00:00 | `4fb5e34a-5799-4464-b2aa-9b6b49a36ef1` |
| 2 | AM_MPS-Anexo VII.docx | MAD | legal | unknown | 95 | 2 | 8cf4e52be01da781 | 2026-04-12T12:25:39.677598+00:00 | `6dd90ac6-a26a-49b3-97f9-9f593785bd49` |

### 412 — sim 0.00 len 0.31

Key: `demiseplan87306411`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Demise Plan(8730641.1).pdf | BHX | legal | working_paper | 40 | 2 | b8c7632a4637c10c | 2026-04-11T18:44:07.809099+00:00 | `5726f952-d8a5-48ed-a178-fbe6e4afb7d3` |
| 2 | Demise Plan(8730641.1).pdf | BHX | legal | unknown | 40 | 1 | c6bcf9a60bc63db6 | 2026-04-11T18:54:29.732256+00:00 | `d0f66b29-a9f5-43a5-877a-7460bf6220f4` |

### 413 — sim 0.00 len 0.68

Key: `structurepaperprojectocean`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Draft Structure Paper - Project Ocean.docx | BHX | legal | draft | 40 | 71 | e4938ffc8c34da49 | 2026-04-11T18:44:39.392816+00:00 | `354cfac1-d1bd-4002-9fac-9de5551a64d1` |
| 2 | Draft Structure Paper - Project Ocean.docx | BHX | legal | draft | 40 | 14 | 9197cb2301b24d26 | 2026-04-11T20:05:44.145401+00:00 | `1e5f20de-b21f-4910-b7a7-482fc4679db9` |

### 414 — sim 0.01 len 0.03

Key: `20241118tablasfase3vf`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241118_Tablas Fase 3_vf.docx | KLP | legal | unknown | 80 | 60 | 7ad12004e8ed33c6 | 2026-04-12T12:40:45.143468+00:00 | `3505d097-a78a-413c-b8f8-a1894ed14dbc` |
| 2 | 20241118_Tablas Fase 3_vf.xlsx | KLP | legal | unknown | 80 | 13 | 343c2817b7274bb2 | 2026-04-12T12:41:47.842766+00:00 | `1b5f2ba2-b631-4ab6-b1ee-bcc56a0cf0a8` |

### 415 — sim 0.05 len 0.25

Key: `20260210memowavesphase21`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260210_Memo Waves_Phase 21.pdf | KLP | legal | unknown | 80 | 194 | 99a552fa983013a4 | 2026-04-12T12:34:10.94566+00:00 | `4ec06ea9-2c5c-4589-9424-ad32f35f9198` |
| 2 | 20260210_Memo Waves_Phase 21.docx | KLP | legal | unknown | 80 | 415 | 5b71ac39d2db18ea | 2026-04-12T12:32:13.286309+00:00 | `228e61f1-e4d3-4971-a987-ffa98a672a9d` |

### 416 — sim 0.05 len 0.28

Key: `20260210memowavesphase21`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260210_Memo Waves_Phase 21.pdf | KLP | legal | unknown | 80 | 194 | 99a552fa983013a4 | 2026-04-12T12:34:10.94566+00:00 | `4ec06ea9-2c5c-4589-9424-ad32f35f9198` |
| 2 | 20260210_Memo Waves_Phase 21.docx | KLP | legal | unknown | 80 | 430 | 0f5d2a1291d5cea0 | 2026-04-12T12:32:16.294725+00:00 | `9316089d-86bb-4215-8e13-39b74d37ef4c` |

### 417 — sim 0.07 len 0.24

Key: `20260202memowavesphase19`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260202_Memo Waves_Phase 19.pdf | KLP | legal | unknown | 80 | 181 | 46d69be281f578a6 | 2026-04-12T12:28:46.987913+00:00 | `6c917bf2-bf07-4f91-8823-99ac571e0225` |
| 2 | 20260202_Memo Waves_Phase 19.docx | KLP | legal | unknown | 80 | 331 | dad5a2a348d98c9e | 2026-04-12T12:25:52.091208+00:00 | `50105154-15af-4d74-9de2-810b9cf4bab7` |

### 418 — sim 0.09 len 0.25

Key: `20260202memowavesphase19`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260202_Memo Waves_Phase 19.pdf | KLP | legal | unknown | 80 | 181 | 46d69be281f578a6 | 2026-04-12T12:28:46.987913+00:00 | `6c917bf2-bf07-4f91-8823-99ac571e0225` |
| 2 | 20260202_Memo Waves_Phase 19.docx | KLP | legal | unknown | 80 | 356 | 4e8f3c1c5e47ffc5 | 2026-04-12T12:26:56.933398+00:00 | `caedc821-9498-40cb-a8a4-19f53ca0ed35` |

### 419 — sim 0.13 len 0.08

Key: `20241227memompsfase5`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 5.pdf | KLP | legal | unknown | 80 | 50 | ed7e768d011d83c5 | 2026-04-12T12:44:57.549635+00:00 | `9d36dd67-a901-4f96-b5f3-67625cba9c81` |
| 2 | 20241227_Memo MPS Fase 5.docx | KLP | legal | unknown | 80 | 86 | b738f15680f3b809 | 2026-04-12T12:43:58.787859+00:00 | `4e9a7e52-a3d4-41bf-aff6-0c53f90e6c8d` |

### 420 — sim 0.16 len 0.15

Key: `20241227memompsfase4`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 4.pdf | KLP | legal | unknown | 80 | 46 | 8c844a66aca0645f | 2026-04-12T12:43:51.706963+00:00 | `574dda3f-4b0d-481d-a1a5-3ecd8e3bde30` |
| 2 | 20241227_Memo MPS Fase 4.docx | KLP | legal | unknown | 80 | 76 | 5ca76ca2d669ddd2 | 2026-04-12T12:42:45.909809+00:00 | `dbadc619-0f01-4b02-a190-97db02034739` |

### 421 — sim 0.16 len 0.17

Key: `20241227memompsfase4`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 4.pdf | KLP | legal | unknown | 80 | 46 | 8c844a66aca0645f | 2026-04-12T12:43:51.706963+00:00 | `574dda3f-4b0d-481d-a1a5-3ecd8e3bde30` |
| 2 | 20241227_Memo MPS Fase 4.docx | KLP | legal | unknown | 80 | 71 | 68f20fe0249beca2 | 2026-04-12T12:42:46.564183+00:00 | `c35800ff-a54f-4924-841f-48890d31ced8` |

### 422 — sim 0.16 len 0.19

Key: `20241227memompsfase5`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 5.pdf | KLP | legal | unknown | 80 | 50 | ed7e768d011d83c5 | 2026-04-12T12:44:57.549635+00:00 | `9d36dd67-a901-4f96-b5f3-67625cba9c81` |
| 2 | 20241227_Memo MPS Fase 5.docx | KLP | legal | unknown | 80 | 81 | 1cca767156d31343 | 2026-04-12T12:43:47.022685+00:00 | `8d647e72-d874-4046-8f61-4f02626aa248` |

### 423 — sim 0.16 len 0.46

Key: `20260126eielevacionapublicodeacuerdodeinversion106kelpaminevica`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260126_EI Elevación a público de acuerdo de inversión_106_Kelpa-Minevica.pdf | KLP | legal | unknown | 90 | 35 | 7ac776431d2a9049 | 2026-04-12T12:25:01.195648+00:00 | `39fe11c4-fbc4-4645-ad3b-ab51da4ddd5a` |
| 2 | 20260126_EI Elevación a público de acuerdo de inversión_106_Kelpa-Minevica.pdf | KLP | legal | unknown | 90 | 19 | f1307406af0ab4fc | 2026-04-12T12:25:50.592408+00:00 | `138d4d21-401b-49ed-9f4b-a12a8bf6d873` |

### 424 — sim 0.18 len 0.14

Key: `20251203poagemswellventures118accountdocx`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251203_PoA Gemswell Ventures 118 account.docx.pdf | GVF | legal | unknown | 90 | 6 | 419d65df185daceb | 2026-04-12T12:35:42.318779+00:00 | `5c6a4a3a-c3b3-4d8c-adb0-91437a7d0f9b` |
| 2 | 20251203_PoA Gemswell Ventures 118 account.docx.pdf | GVF | legal | unknown | 90 | 1 | 6ba2a770a47e201c | 2026-04-12T12:33:34.540975+00:00 | `a589cf28-25da-4446-ab63-8d964e8e762d` |

### 425 — sim 0.19 len 0.17

Key: `20240814memofase2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240814_Memo Fase 2.pdf | KLP | legal | unknown | 90 | 20 | 46267303adc8c1ce | 2026-04-12T12:53:43.257879+00:00 | `55da3c56-5068-4673-b5be-bd9eca98f796` |
| 2 | 20240814_Memo Fase 2.docx | KLP | legal | unknown | 90 | 38 | 024d6b27ba46ef31 | 2026-04-12T12:53:06.327977+00:00 | `dadbf903-b740-4de5-ac8a-607409f210d5` |

### 426 — sim 0.22 len 0.08

Key: `20240814memofase2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240814_Memo Fase 2.pdf | KLP | legal | unknown | 90 | 20 | 46267303adc8c1ce | 2026-04-12T12:53:43.257879+00:00 | `55da3c56-5068-4673-b5be-bd9eca98f796` |
| 2 | 20240814_Memo Fase 2.docx | KLP | legal | unknown | 90 | 53 | 8fa8a8a6f88043c9 | 2026-04-12T12:53:50.245031+00:00 | `0f37cf6c-1465-4990-86b5-2266d3e066a6` |

### 427 — sim 0.24 len 0.00

Key: `ammpsanexoiii`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | AM_MPS-Anexo III.pdf | MAD | legal | unknown | 95 | 1 | 3c49673f975bf597 | 2026-04-12T12:25:38.26656+00:00 | `32702804-846e-4390-9f50-443a7a82bef0` |
| 2 | AM_MPS-Anexo III.docx | MAD | legal | unknown | 95 | 2 | 319afc27109ee104 | 2026-04-12T12:25:34.36668+00:00 | `d495ab13-2305-4f5e-ab0a-6052852d1ec4` |

### 428 — sim 0.24 len 0.13

Key: `20250730memoopcowavesfase1v2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250730_Memo OpCo Waves_Fase 1v2.pdf | GVF | legal | unknown | 85 | 3 | 938445f840176dd0 | 2026-04-12T12:33:32.870128+00:00 | `b8a0d2ba-5904-4f3a-89a3-8d3459fcc56e` |
| 2 | 20250730_Memo OpCo Waves_Fase 1v2.docx | GVF | legal | unknown | 85 | 3 | f5cee2e2e51e26a0 | 2026-04-12T12:35:06.493677+00:00 | `0605afef-a54b-400c-9308-bd62c06a0064` |

### 429 — sim 0.25 len 0.34

Key: `contratodeprestamopmiimps06032025vlimpia`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Contrato de préstamo PMII - MPS_06032025 (002) (002) V.limpia.docx | KLP | legal | unknown | 90 | 17 | 57530381b5942a82 | 2026-04-12T12:52:50.101242+00:00 | `31dfc4eb-576a-4968-8453-7fa5fc4ef2e3` |
| 2 | Contrato de préstamo PMII - MPS_06032025 (002) (002) V.limpia.docx | KLP | legal | unknown | 80 | 7 | 1084d83df3fe5172 | 2026-04-12T12:53:14.491636+00:00 | `08348d4b-49a9-47de-a9d7-b53090cb76b8` |

### 430 — sim 0.26 len 0.05

Key: `20250228memocompraopcowavesfase0`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250228_Memo Compra OpCo Waves_Fase 0.pdf | GVF | legal | unknown | 85 | 1 | 20e851f3c32f0a1a | 2026-04-12T12:32:19.76835+00:00 | `f894a7db-40bc-406d-a7b0-f3285435e4ab` |
| 2 | 20250228_Memo Compra OpCo Waves_Fase 0.docx | GVF | legal | unknown | 85 | 4 | e6888a031781dbd2 | 2026-04-12T12:32:15.992629+00:00 | `8cdeab8b-2f4a-4b24-b0eb-6b9f9ed98da7` |

### 431 — sim 0.27 len 0.80

Key: `leaseagreementeconomicterms`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Lease Agreement Economic Terms signed.pdf | MAD | legal | executed | 95 | 1 | 4a374c6afb4a3f26 | 2026-04-12T12:29:11.063561+00:00 | `84567fac-3820-4206-8bc8-3dbd0ea5a4a3` |
| 2 | Lease Agreement Economic Terms.docx | MAD | legal | unknown | 95 | 1 | bccac82ea3161482 | 2026-04-12T12:29:12.374746+00:00 | `0d66b3c5-5baa-4200-83f2-daf57f822905` |

### 432 — sim 0.29 len 0.50

Key: `20241118memofase3nn`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241118_Memo Fase 3_NN.docx | KLP | legal | unknown | 80 | 65 | 01dfecd36730ae92 | 2026-04-12T12:39:50.689746+00:00 | `035740dc-3282-4eb4-882d-ac948c91da24` |
| 2 | 20241118_Memo Fase 3_NN.docx | KLP | legal | unknown | 80 | 65 | 9cf8de28ee311c71 | 2026-04-12T12:39:46.722442+00:00 | `06526335-7cf9-4e22-9b21-763da58286c4` |

### 433 — sim 0.30 len 0.62

Key: `20241118tablasfase3vf`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241118_Tablas Fase 3_vf.docx | KLP | legal | unknown | 80 | 60 | 7ad12004e8ed33c6 | 2026-04-12T12:40:45.143468+00:00 | `3505d097-a78a-413c-b8f8-a1894ed14dbc` |
| 2 | 20241118_Tablas Fase 3_vf.docx | KLP | legal | unknown | 80 | 60 | 9bd79f3f682e7b59 | 2026-04-12T12:40:47.878427+00:00 | `c78b4671-2eed-44a1-bd40-91b2b52692f5` |

### 434 — sim 0.31 len 0.34

Key: `estructura`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | ESTRUCTURA.pdf | GVF | legal | draft | 40 | 4 | d6d7498feae9cd8e | 2026-04-12T12:41:41.754002+00:00 | `25e0e7a4-71d1-430c-ae9a-592933812717` |
| 2 | ESTRUCTURA.docx | GVF | legal | draft | 40 | 12 | 321e658601431966 | 2026-04-12T12:42:13.313987+00:00 | `3b2410af-4669-40d9-ba22-5534b5530e63` |

### 435 — sim 0.32 len 0.34

Key: `20260126eiaumentodecapitalsocial116kelpaexpansion`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260126_EI Aumento de capital social_116_Kelpa Expansión.pdf | GVF | legal | unknown | 90 | 33 | bd21360a073d5fcf | 2026-04-12T12:31:02.874044+00:00 | `63a0ddb1-a43c-4272-a97c-0a94f0ba7387` |
| 2 | 20260126_EI Aumento de capital social_116_Kelpa Expansión.pdf | GVF | legal | unknown | 90 | 10 | 0548be77590cb99d | 2026-04-12T12:32:46.504709+00:00 | `e5ff8d96-8024-45f1-a41c-c4dfb5881a7b` |

### 436 — sim 0.35 len 0.32

Key: `20240619madfirstamendaarev1`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240619 MAD First Amend. AA_rev1.pdf | GVF | legal | unknown | 95 | 7 | 1d333b6f8ad55601 | 2026-04-12T12:07:11.84839+00:00 | `bb3b8773-488d-439d-8d8c-32f8881171f0` |
| 2 | 20240619 MAD First Amend. AA_rev1.docx | GVF | legal | unknown | 95 | 7 | 0c29e81569e4425b | 2026-04-12T12:07:09.600401+00:00 | `88ec0de6-9c5f-4c1a-b66f-fd53bc8877f9` |

### 437 — sim 0.37 len 0.34

Key: `krefeldmou`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Krefeld MOU (004).docx | GVF | legal | signed | 90 | 8 | eadb319b8743de1d | 2026-04-12T12:39:47.231032+00:00 | `ccdc3256-07fc-442d-9909-b9486dc3d948` |
| 2 | Krefeld MOU (004).docx | GVF | legal | draft | 90 | 3 | eac5d37e6c5fccc2 | 2026-04-12T12:38:26.722054+00:00 | `ff8ff17f-3c4f-40a7-b16f-f2900197f8a0` |

### 438 — sim 0.38 len 0.07

Key: `madridplayasurfsl`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MADRID PLAYA SURF SL signed.pdf | MAD | legal | signed | 90 | 2 | 7e74dc9a10825dd1 | 2026-04-12T11:28:12.871629+00:00 | `d92fd519-d495-4dfa-a9ae-444ac4cacb5b` |
| 2 | MADRID PLAYA SURF SL.docx | MAD | legal | signed | 90 | 27 | efc097a6e001a4fe | 2026-04-12T11:28:26.933837+00:00 | `b4938679-d957-4fcb-ba25-03316c80a3f4` |

### 439 — sim 0.38 len 0.20

Key: `20250801tablasmps`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250801 Tablas MPS.xlsx | KLP | legal | unknown | 80 | 24 | 38024e8fcd82a016 | 2026-04-12T12:53:06.132974+00:00 | `22443398-6dbd-4502-b919-9a4334ebe88f` |
| 2 | 20250801 Tablas MPS.xlsx | KLP | legal | unknown | 80 | 5 | 896e144bc73d4832 | 2026-04-12T12:51:50.635415+00:00 | `4d718d32-9cc9-4608-ba1c-28a00dbdcbdb` |

### 440 — sim 0.38 len 0.82

Key: `actaacuerdossocialeslonabarcelonaslgemswell18032025`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Acta Acuerdos Sociales LONA BARCELONA SL (GEMSWELL) 18.03.2025.pdf | KLP | legal | unknown | 90 | 19 | 02d52168dc0bba59 | 2026-04-12T12:56:41.817963+00:00 | `f3031cdb-57ac-49f6-aef5-e9459b270f8c` |
| 2 | Acta Acuerdos Sociales LONA BARCELONA SL (GEMSWELL) 18.03.2025.docx | KLP | legal | unknown | 85 | 13 | c2bba307971eba8c | 2026-04-12T12:56:39.838276+00:00 | `7c497564-5f01-43e6-848d-9d9803aaeed0` |

### 441 — sim 0.39 len 0.61

Key: `20251217tablaswaves`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251217 Tablas Waves.xlsx | KLP | legal | unknown | 80 | 35 | 7008f6569a336b1b | 2026-04-12T12:16:05.786188+00:00 | `3f823b8b-b8f0-46c8-b7b6-e77a5dade794` |
| 2 | 20251217 Tablas Waves.xlsx | KLP | legal | unknown | 80 | 23 | 2b48b8187472882d | 2026-04-12T12:14:57.993932+00:00 | `ddef5f3d-3ae9-459b-9ee4-64ca6529908b` |

### 442 — sim 0.41 len 0.66

Key: `estructura`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | ESTRUCTURA.pdf | GVF | legal | draft | 40 | 4 | d6d7498feae9cd8e | 2026-04-12T12:41:41.754002+00:00 | `25e0e7a4-71d1-430c-ae9a-592933812717` |
| 2 | ESTRUCTURA.docx | GVF | legal | draft | 40 | 22 | ffcdc742fe448604 | 2026-04-12T12:41:27.11031+00:00 | `759cc8c4-7256-42e4-804f-778ea4cb57cb` |

### 443 — sim 0.42 len 0.42

Key: `actaconsejokelpafinanciaciondemps17022026vl`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Acta_Consejo_Kelpa_Financiacion_de_MPS_17.02.2026_vl.pdf | GVF | legal | unknown | 90 | 45 | 2c680e3286251ee4 | 2026-04-12T12:33:44.449397+00:00 | `7dacf63a-3e1a-45bf-b1e9-0fb74efb9313` |
| 2 | Acta_Consejo_Kelpa_Financiacion_de_MPS_17.02.2026_vl.pdf | GVF | legal | unknown | 90 | 18 | a773c026c07ee435 | 2026-04-12T12:31:12.547117+00:00 | `bd1f655a-4508-4534-ad8a-d226b91da517` |

### 444 — sim 0.43 len 0.44

Key: `guillecaracedogemsweelfirmado`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Guille Caracedo GEMSWEEL_firmado.pdf | GVF | legal | signed | 90 | 41 | 83839ce2f809d701 | 2026-04-12T12:21:44.624339+00:00 | `fa8444f7-4200-49f1-8818-b94d57fb26d1` |
| 2 | Guille Caracedo GEMSWEEL_firmado.pdf | GVF | legal | signed | 90 | 14 | ec7cbe304c1c68aa | 2026-04-12T12:22:57.348475+00:00 | `1dda3b3d-f9ef-4081-a993-6ca0a7e78a59` |

### 445 — sim 0.43 len 0.81

Key: `20241118memofase3`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241118_Memo Fase 3.docx | KLP | legal | unknown | 80 | 64 | 03ca1833d9d73968 | 2026-04-12T12:38:57.970102+00:00 | `56f76628-3bbe-49a6-8acd-764803b7eec1` |
| 2 | 20241118_Memo Fase 3.docx | KLP | legal | unknown | 80 | 64 | aca4b9f259d73b1d | 2026-04-12T12:38:52.699246+00:00 | `99d9e789-df61-44aa-af0f-abde85bd8ca6` |

### 446 — sim 0.47 len 0.75

Key: `gemswellventureseecc2024`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | GEMSWELL VENTURES EE CC 2024.pdf | KLP | legal | unknown | 85 | 35 | f9a751a207a648a5 | 2026-04-12T12:54:28.26914+00:00 | `b1b16ddc-5a42-4fb7-a093-fa1df654396e` |
| 2 | GEMSWELL VENTURES EE CC 2024 (2).pdf | KLP | legal | unknown | 85 | 27 | 385fc55078cb96e9 | 2026-04-12T12:54:40.814195+00:00 | `1ac7e74c-0941-4b3e-a213-568e1247752f` |

### 447 — sim 0.54 len 0.56

Key: `20250725memompsfase8`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250725_Memo MPS Fase 8.docx | KLP | legal | unknown | 80 | 137 | fcd08ab466a6d99a | 2026-04-12T12:50:51.446078+00:00 | `8e81140b-9e3e-4ca1-b07c-d5cd46f567d8` |
| 2 | 20250725_Memo MPS Fase 8.docx | KLP | legal | unknown | 80 | 127 | f6015f2b8d4d82b0 | 2026-04-12T12:51:47.676377+00:00 | `56a46fa4-971e-4ec0-8584-0f020d5846fd` |

### 448 — sim 0.54 len 0.75

Key: `informeampliaciondecapitalvaldorbametropolitano28425`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Informe ampliación de capital  (VALDORBA METROPOLITANO) 28.4.25.pdf | KLP | legal | unknown | 90 | 8 | a0ac4eccf9243f77 | 2026-04-12T12:50:40.286923+00:00 | `73b6406d-8b4c-48a3-bb64-80c74d66a2b5` |
| 2 | Informe ampliación de capital  (VALDORBA METROPOLITANO) 28.4.25.docx | KLP | legal | unknown | 80 | 8 | a516160aef979b2d | 2026-04-12T12:50:38.107648+00:00 | `2be64b20-e6a4-4db2-b6f7-febe13b5e02f` |

### 449 — sim 0.55 len 0.90

Key: `informeampliaciondecapitalvaldorbametropolitano6924`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Informe ampliación de capital  (VALDORBA METROPOLITANO) 6.9.24.pdf | KLP | legal | unknown | 90 | 7 | 34c8471c916579e9 | 2026-04-12T12:54:08.117756+00:00 | `9020136c-4f33-42b1-8098-fa3899e064e8` |
| 2 | Informe ampliación de capital  (VALDORBA METROPOLITANO) 6.9.24.docx | KLP | legal | unknown | 90 | 9 | 5acc3b915613ac12 | 2026-04-12T12:54:06.491209+00:00 | `1fb9178d-158d-4b8e-83ae-8f3165fead23` |

### 450 — sim 0.55 len 0.93

Key: `20251216memowavesphase16`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251216_Memo Waves_Phase 16.docx | KLP | legal | unknown | 80 | 286 | 801678724980d4bf | 2026-04-12T12:18:07.895076+00:00 | `997e0bef-8bdd-434b-b069-f4bd8ce457e7` |
| 2 | 20251216_Memo Waves_Phase 16.docx | KLP | legal | unknown | 80 | 281 | bfe7a7488c7f3a43 | 2026-04-12T12:19:00.811979+00:00 | `97831c7d-606d-4500-9836-9dcb065a07af` |

### 451 — sim 0.56 len 0.64

Key: `20251027memompsphase11`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251027_Memo MPS_Phase 11.docx | KLP | legal | unknown | 80 | 196 | d86769f89f4c505d | 2026-04-12T12:10:00.663893+00:00 | `bb2731b0-04ca-4f2a-a0cd-3a75f18d50a4` |
| 2 | 20251027_Memo MPS_Phase 11.docx | KLP | legal | unknown | 80 | 176 | 1df63e1743e7cd50 | 2026-04-12T12:08:56.02408+00:00 | `40e862ad-66da-474f-834d-4c05e615fa96` |

### 452 — sim 0.57 len 0.90

Key: `contratoprestamokelpavaldorba6924`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Contrato préstamo KELPA-VALDORBA 6.9.24.pdf | KLP | legal | unknown | 90 | 23 | 3aa49e1193980ee8 | 2026-04-12T12:54:04.682622+00:00 | `39fc82cf-82d1-4d12-b564-0285a78a9150` |
| 2 | Contrato préstamo KELPA-VALDORBA 6.9.24.docx | KLP | legal | unknown | 90 | 9 | d6fc7be17464b7f6 | 2026-04-12T12:54:03.076551+00:00 | `b21f3004-3899-422b-bf5c-afe0ed50e3ad` |

### 453 — sim 0.60 len 0.93

Key: `20240906prestamo600000vsoreiiikelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240906 Préstamo 600.000 € VSORE III Kelpa.pdf | KLP | legal | unknown | 90 | 20 | 29e9dea6502d250c | 2026-04-12T12:53:49.431026+00:00 | `af0f8224-2bac-42c4-a09b-2fbcb34ce6c1` |
| 2 | 20240906 Préstamo 600.000 € VSORE III Kelpa.docx | KLP | legal | unknown | 90 | 24 | 47c599bd02f4b233 | 2026-04-12T12:53:45.962102+00:00 | `dc191261-e2be-4a27-b3bb-caf0e9514f70` |

### 454 — sim 0.61 len 0.74

Key: `declaraciontitularidadrealgeneralriesgomedio`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | DECLARACION TITULARIDAD REAL GENERAL_RIESGO MEDIO.pdf | MAD | legal | unknown | 90 | 7 | fb67d4735f46f405 | 2026-04-12T13:38:23.189858+00:00 | `20fba40b-8090-4cbd-a3fb-844c6a4384c7` |
| 2 | DECLARACION TITULARIDAD REAL GENERAL_RIESGO MEDIO.docx | MAD | legal | unknown | 90 | 5 | 8c7032080f944437 | 2026-04-12T13:38:21.608436+00:00 | `afbf6cad-7085-4ade-917f-fa431a3d5e3a` |

### 455 — sim 0.62 len 0.65

Key: `appendix1operatingagreement`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Appendix 1_Operating Agreement.pdf | PHILAE | legal | executed | 90 | 3 | 1e7a064d40c76b36 | 2026-04-12T12:12:10.671726+00:00 | `66147557-2b8a-4090-9821-9f26d31dea31` |
| 2 | Appendix 1_Operating Agreement.docx | PHILAE | legal | unknown | 40 | 2 | 5f6d2600eee182a5 | 2026-04-12T12:11:25.144683+00:00 | `23c22638-ac64-4872-a9d5-1f6116364db6` |

### 456 — sim 0.62 len 0.91

Key: `gemswellventuresaportacioncuenta118250000`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Gemswell Ventures- Aportación cuenta 118 (250.000€).pdf | GVF | legal | unknown | 90 | 2 | 5e4a175bc2289f0e | 2026-04-12T12:33:49.233632+00:00 | `69540cbe-2396-4021-b6f2-400f4adceddb` |
| 2 | Gemswell Ventures- Aportación cuenta 118 (250.000€).docx | GVF | legal | unknown | 90 | 2 | 8376f3d05cc4b8c7 | 2026-04-12T12:33:47.391944+00:00 | `4dd2f705-63a3-40cb-9dbf-950fe651fa43` |

### 457 — sim 0.62 len 0.95

Key: `acuerdoa4obligacionesauditoriampsbuenavistaatmcsjoct25rev4`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Acuerdo a 4 obligaciones auditoría MPS-Buenavista-ATM-CSJ (oct 25) rev 4 clean.pdf | MAD | legal | unknown | 95 | 20 | 42688c984ac4b149 | 2026-04-12T13:35:59.67414+00:00 | `51d654c6-2ccc-4f13-8906-185d639d155b` |
| 2 | Acuerdo a 4 obligaciones auditoría MPS-Buenavista-ATM-CSJ (oct 25) rev 4 clean.docx | MAD | legal | unknown | 95 | 11 | a697a456d705bbe6 | 2026-04-12T13:35:57.107754+00:00 | `86806e78-b2d3-430e-abb4-e309bc5337c1` |

### 458 — sim 0.63 len 0.94

Key: `contratodecesiondecreditotch3valdorbametropolitano6924`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Contrato de cesión de crédito TCH3-VALDORBA METROPOLITANO 6.9.24.pdf | KLP | legal | unknown | 90 | 24 | fc5c665f7110ebf3 | 2026-04-12T12:54:01.40076+00:00 | `c2fd012b-fb43-4118-b336-98f43d7825be` |
| 2 | Contrato de cesión de crédito TCH3-VALDORBA METROPOLITANO 6.9.24.docx | KLP | legal | unknown | 90 | 11 | 99b015d4551055c2 | 2026-04-12T12:53:59.040245+00:00 | `d3cf1931-e565-4c58-a860-c722986b9dea` |

### 459 — sim 0.64 len 0.63

Key: `vsoreiipoakelpacapitalincrease`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | VSORE II - PoA KELPA-Capital Increase.docx | KLP | legal | unknown | 90 | 16 | 002ee959ee8da1d9 | 2026-04-12T12:50:44.672299+00:00 | `d8ed7f51-afbd-4f80-9e4e-666bd8c4bfd5` |
| 2 | VSORE II - PoA KELPA-Capital Increase.docx | KLP | legal | unknown | 90 | 11 | 01a7a40b5de21786 | 2026-04-12T12:51:30.142758+00:00 | `ccbfdb55-8180-4f2c-b855-dced7462fb71` |

### 460 — sim 0.64 len 0.79

Key: `20251212eicvdeparticipacionessociales2113kelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251212_EI  CV de participaciones sociales_2113_Kelpa.pdf | GVF | legal | unknown | 90 | 79 | cbd05d90521124f8 | 2026-04-12T12:29:42.605675+00:00 | `92ecb048-d399-45f1-9236-b12a320598cc` |
| 2 | 20251212_EI  CV de participaciones sociales_2113_Kelpa.pdf | GVF | legal | unknown | 90 | 64 | 3e8322d40f5c5801 | 2026-04-12T12:27:52.053342+00:00 | `72be8583-802e-4c72-b295-e30404217873` |

### 461 — sim 0.64 len 0.89

Key: `20260122tablaswavesphase18`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260122 Tablas Waves_Phase 18.xlsx | KLP | legal | unknown | 80 | 43 | d971941a5e02fde1 | 2026-04-12T12:22:04.780648+00:00 | `42ffad0c-26b1-43dc-b6bf-7539f9e7b925` |
| 2 | 20260122 Tablas Waves_Phase 18.xlsx | KLP | legal | unknown | 80 | 38 | 796355d7a3def8ed | 2026-04-12T12:22:58.182498+00:00 | `66d330af-c5dc-4c7a-9fe5-f906f0e01702` |

### 462 — sim 0.66 len 0.91

Key: `20240906actajgampliacioncapitalyaprobacionampliacionmpskelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240906_Acta JG_ ampliación capital y aprobación ampliación MPS_KELPA.pdf | KLP | legal | unknown | 90 | 5 | cafa002bbcd169d2 | 2026-04-12T12:53:53.366994+00:00 | `e60c38a8-384c-4e96-b623-790df637998d` |
| 2 | 20240906_Acta JG_ ampliación capital y aprobación ampliación MPS_KELPA.docx | KLP | legal | unknown | 90 | 8 | 322da51cfb2659ee | 2026-04-12T12:53:51.787187+00:00 | `d0964817-756f-4946-8b8f-f548310bb2d1` |

### 463 — sim 0.66 len 0.95

Key: `actaaprobacionccaa24gemswell`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Acta_aprobación_CCAA'24_GEMSWELL.pdf | KLP | legal | unknown | 90 | 2 | f88018621d1f20b7 | 2026-04-12T12:54:46.129031+00:00 | `0cdb553e-ca89-41bf-841d-41716442c5a9` |
| 2 | Acta aprobación CCAA'24 GEMSWELL.DOCX | KLP | legal | unknown | 90 | 2 | e213b9a322e60e05 | 2026-04-12T12:54:12.773325+00:00 | `68b86689-1eae-4a19-858a-70cd92d1b2d8` |

### 464 — sim 0.66 len 0.95

Key: `secondloanagreementswinfrasportsuscl`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Second Loan Agreement SW Infrasports USCL.pdf | KLP | legal | signed | 90 | 24 | 2a6895ebc647031e | 2026-04-11T18:04:41.264733+00:00 | `f1f75ca1-dbdd-4e66-b6a6-c827502fc907` |
| 2 | Second Loan Agreement SW Infrasports USCL.docx | KLP | legal | signed | 90 | 21 | b2b83ec43aa176a6 | 2026-04-11T18:03:36.756393+00:00 | `e46bee4f-50ac-4f0c-b4ae-36d42fe7313d` |

### 465 — sim 0.66 len 0.99

Key: `20240906certificadoactajgampliacioncapitalyaprobacionampliacionmpskelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240906_Certificado Acta JG_ ampliación capital y aprobación ampliación MPS_KELPA.pdf | KLP | legal | unknown | 90 | 9 | fa73cdacb8973030 | 2026-04-12T12:53:55.863339+00:00 | `93eda1f1-5d74-41c0-b29f-c9975e8d0fdd` |
| 2 | 20240906_Certificado Acta JG_ ampliación capital y aprobación ampliación MPS_KELPA.docx | KLP | legal | unknown | 90 | 5 | fabaac35e2eb645c | 2026-04-12T12:53:54.605935+00:00 | `49b34a7e-8e14-488e-a5a5-8353645960ba` |

### 466 — sim 0.67 len 0.77

Key: `20251216memowavesphase15`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251216_Memo Waves_Phase 15.docx | KLP | legal | unknown | 80 | 261 | 87d6d225980260d6 | 2026-04-12T12:15:55.476993+00:00 | `163dd0dc-783a-4f05-b84c-5b09f47dad37` |
| 2 | 20251216_Memo Waves_Phase 15.docx | KLP | legal | unknown | 80 | 261 | 9d0a8b0949fb523d | 2026-04-12T12:16:50.63157+00:00 | `87c32327-cc0c-4fe3-9555-b0069f612597` |

### 467 — sim 0.67 len 0.88

Key: `gslagoonrestaurantbirminghamrevmarta`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | GS_LAGOON RESTAURANT_BIRMINGHAM_rev Marta.pdf | BHX | legal | draft | 40 | 8 | 4568af4c90b4e9b6 | 2026-04-11T19:44:47.854597+00:00 | `0046133e-4fa1-4b62-99b4-8ab4bd923fee` |
| 2 | GS_LAGOON RESTAURANT_BIRMINGHAM_rev Marta.docx | BHX | legal | draft | 0 | 28 | fbdeba7933e078f0 | 2026-04-11T19:44:19.332649+00:00 | `0000afd8-29cb-4d67-860d-5db45ce34e5e` |

### 468 — sim 0.67 len 0.96

Key: `loanagreementuscltch3`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Loan Agreement USCL - TCH3.pdf | KLP | legal | signed | 90 | 25 | d35f5278ea9b90ec | 2026-04-11T18:06:03.583326+00:00 | `949dee26-c2cf-4daa-876a-2f036b14a1cf` |
| 2 | Loan Agreement USCL - TCH3.docx | KLP | legal | signed | 90 | 23 | 094d2dc636283f03 | 2026-04-11T18:05:48.514215+00:00 | `ce9cf240-7f97-4aeb-b935-9a0d39fda91a` |

### 469 — sim 0.69 len 0.97

Key: `20250801memompsphase9`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250801_Memo MPS_Phase 9.docx | KLP | legal | unknown | 80 | 142 | 4adfac73f813e028 | 2026-04-12T12:46:25.213798+00:00 | `f017ec4f-0344-47cc-8947-937a52fe305b` |
| 2 | 20250801_Memo MPS_Phase 9.docx | KLP | legal | unknown | 80 | 132 | 355fb321f2bf66d5 | 2026-04-12T12:46:55.655934+00:00 | `35f1c0a5-bdad-4d48-9fe4-a2ebd18e8172` |

### 470 — sim 0.72 len 0.70

Key: `413554510928v1waveparkmanagementagreement151024docxcc15052024redline`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 4135-5451-0928 v 1 Wave Park Management Agreement 151024.docx (CC 15.05.2024) (redline).docx | GVF | legal | unknown | 90 | 48 | d7f0d6ec5364c673 | 2026-04-12T12:21:59.363948+00:00 | `419c3dab-70bf-421c-a8d4-8719ead2928c` |
| 2 | 4135-5451-0928 v 1 Wave Park Management Agreement 151024.docx (CC 15.05.2024) (redline).docx | GVF | legal | unknown | 90 | 32 | df19bca0e5c449a3 | 2026-04-12T12:23:54.47015+00:00 | `f67bfc0e-c85c-4fda-9889-fe5b98642da3` |

### 471 — sim 0.72 len 0.97

Key: `ndampsunilateralgemswellgenerico`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | NDA MPS (unilateral) GEMSWELL (genérico).docx | GVF | legal | unknown | 90 | 17 | cbeee2b9ce8ab31d | 2026-04-12T12:24:44.470835+00:00 | `66742567-bb7b-4808-b443-5d8bcbc86e73` |
| 2 | NDA MPS (unilateral) GEMSWELL (genérico).docx | GVF | legal | unknown | 90 | 12 | 4c0da65bd67c9180 | 2026-04-12T12:22:29.864692+00:00 | `56b9952f-df5b-4e53-8130-1518edf97fa3` |

### 472 — sim 0.72 len 0.97

Key: `projectoceanlegalcostsindemnityletter`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Project Ocean - Legal costs indemnity letter.pdf | BHX | legal | signed | 90 | 2 | 7a0dc670d72a7053 | 2026-04-11T19:36:57.558017+00:00 | `91ccfedb-653a-4ecd-ad15-83423525cbc6` |
| 2 | Project Ocean - Legal costs indemnity letter.docx | BHX | legal | signed | 90 | 2 | b13e00935b16334a | 2026-04-11T19:38:53.105785+00:00 | `2f9a0831-7ddb-4910-99cf-a9a0cfb41c24` |

### 473 — sim 0.74 len 0.84

Key: `contratowgvaldorbabirminghammodificaciondecontratosrevcga`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Contrato WG-VALDORBA-BIRMINGHAM (modificación de contratos)_Rev CGA.docx | GVF | legal | unknown | 95 | 16 | 1f0f6f24bb35a550 | 2026-04-12T12:45:36.624774+00:00 | `5d140772-6f12-4880-b225-e6cb43a62f5f` |
| 2 | Contrato WG-VALDORBA-BIRMINGHAM (modificación de contratos)_Rev CGA.docx | GVF | legal | unknown | 95 | 11 | 2f4553c3159143c4 | 2026-04-12T12:44:31.700898+00:00 | `ad1eca79-292f-4175-baec-29eb223a0b1c` |

### 474 — sim 0.74 len 0.99

Key: `202601xxmemowavesphase18`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 202601XX_Memo Waves_Phase 18.docx | KLP | legal | unknown | 80 | 241 | 603ebe4328bcd875 | 2026-04-12T12:35:02.314099+00:00 | `ef5820e2-27b8-4a7e-a9d6-89c8853da5b4` |
| 2 | 202601XX_Memo Waves_Phase 18.docx | KLP | legal | unknown | 80 | 236 | 9c6816363f46e7fc | 2026-04-12T12:35:56.198314+00:00 | `8851247e-4624-4ed1-a354-fb956243fc24` |

### 475 — sim 0.76 len 0.82

Key: `20240611memofase2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240611_Memo Fase 2.docx | KLP | legal | unknown | 80 | 36 | 8672736bb6c6d1dc | 2026-04-12T12:38:08.672517+00:00 | `500bd1ca-c2f0-4308-8af7-b04cbea11070` |
| 2 | 20240611_Memo Fase 2.docx | KLP | legal | unknown | 80 | 26 | 0f84ba982fadfdd3 | 2026-04-12T12:37:58.86835+00:00 | `fdea74ed-dcd3-42b7-a34d-d21859a07987` |

### 476 — sim 0.77 len 0.60

Key: `20241227memompsfase5`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 5.pdf | KLP | legal | unknown | 80 | 50 | ed7e768d011d83c5 | 2026-04-12T12:44:57.549635+00:00 | `9d36dd67-a901-4f96-b5f3-67625cba9c81` |
| 2 | 20241227_Memo MPS Fase 5.pdf | KLP | legal | unknown | 80 | 32 | e65926de0887040c | 2026-04-12T12:45:00.587729+00:00 | `06956a02-e642-49ab-bba1-2337624a35e2` |

### 477 — sim 0.78 len 0.48

Key: `20250428tablasmps`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250428 Tablas MPS.xlsx | KLP | legal | unknown | 80 | 20 | 16f83ee0419ffaf9 | 2026-04-12T12:49:09.025183+00:00 | `49ec5aff-58e7-4503-8569-9ab42b3685ea` |
| 2 | 20250428 Tablas MPS.xlsx | KLP | legal | unknown | 80 | 10 | 98724975b010a76b | 2026-04-12T12:49:18.064752+00:00 | `a0eeec21-e372-4a4d-a5af-a08d626370cc` |

### 478 — sim 0.79 len 0.74

Key: `loanagreement130000gbpwphauscl`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Loan Agreement 130,000 GBP WPH a USCL.pdf | KLP | legal | signed | 90 | 56 | 6fb051f45a3caf18 | 2026-04-11T17:28:21.53444+00:00 | `ad7457f1-7d04-4347-9f48-1be6cc878823` |
| 2 | Loan Agreement 130,000 GBP WPH a USCL.docx | KLP | legal | signed | 90 | 103 | cac45accf56ecf7d | 2026-04-11T17:27:57.808814+00:00 | `725958ea-2809-43b2-a958-9d33fe7b3022` |

### 479 — sim 0.80 len 0.72

Key: `loanagreement130000gbpkelpaawph`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Loan Agreement 130,000 GBP Kelpa a WPH.pdf | KLP | legal | signed | 90 | 60 | 20909d931bf437de | 2026-04-11T17:27:13.580543+00:00 | `751974a4-6987-4a35-9229-ae91a1e0cec8` |
| 2 | Loan Agreement 130,000 GBP Kelpa a WPH.docx | KLP | legal | signed | 90 | 130 | 441791fb3d9f124c | 2026-04-11T17:26:43.317868+00:00 | `00256114-681b-4f4c-85cb-d06998459870` |

### 480 — sim 0.80 len 0.77

Key: `jociastulacontratopublicidadgemswellfirmado`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Jo Ciastula_Contrato Publicidad Gemswell_firmado.pdf | GVF | legal | signed | 90 | 40 | feb1995ef3cfe4a7 | 2026-04-12T12:21:48.455863+00:00 | `b0c5da5f-0581-482e-ada5-2b262d0bb357` |
| 2 | Jo Ciastula_Contrato Publicidad Gemswell_firmado.pdf | GVF | legal | signed | 90 | 32 | d3ca5f0da350055f | 2026-04-12T12:23:31.405264+00:00 | `b554315e-5963-48d3-8741-b882ebc5c96f` |

### 481 — sim 0.80 len 0.98

Key: `20251217eipodergeneralavis2148kelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251217_EI Poder general a VIS_2148_Kelpa.pdf | GVF | legal | unknown | 90 | 82 | c76fed413c551c67 | 2026-04-12T12:30:55.208331+00:00 | `c353e624-a622-4c5e-b731-0f45d29cd537` |
| 2 | 20251217_EI Poder general a VIS_2148_Kelpa.pdf | GVF | legal | unknown | 90 | 68 | fc66f7977e6aa28a | 2026-04-12T12:32:28.445503+00:00 | `ac5cfc98-6bca-4b94-9c4f-ee8846c05ef3` |

### 482 — sim 0.81 len 0.78

Key: `20240927memofase2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20240927_Memo Fase 2.docx | KLP | legal | unknown | 80 | 48 | d94533f5b77688ab | 2026-04-12T12:37:57.864414+00:00 | `4cce6acc-e3d4-4545-8179-a0de36176e5c` |
| 2 | 20240927_Memo Fase 2.docx | KLP | legal | unknown | 80 | 48 | 38ea7b2254fff5b8 | 2026-04-12T12:37:47.447681+00:00 | `e5e1bd9a-64db-4273-a05e-fb17c498474d` |

### 483 — sim 0.81 len 0.82

Key: `leaseagreementeconomicterms`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Lease Agreement Economic Terms signed.pdf | MAD | legal | executed | 95 | 1 | 4a374c6afb4a3f26 | 2026-04-12T12:29:11.063561+00:00 | `84567fac-3820-4206-8bc8-3dbd0ea5a4a3` |
| 2 | Lease Agreement Economic Terms.pdf | MAD | legal | unknown | 95 | 1 | 8f2875c18631c948 | 2026-04-12T12:29:13.736049+00:00 | `b50f9c61-0192-4d65-a2b1-f00becaad641` |

### 484 — sim 0.82 len 0.82

Key: `20250428memompsfase7`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250428_Memo MPS Fase 7.docx | KLP | legal | unknown | 80 | 130 | ad14a903cdb5cda0 | 2026-04-12T12:49:12.30563+00:00 | `5e2c8a96-f9a2-4ef9-8578-10b0d5f4be73` |
| 2 | 20250428_Memo MPS Fase 7.docx | KLP | legal | unknown | 80 | 118 | 49efb3ebb2742ad4 | 2026-04-12T12:49:41.67068+00:00 | `f01625d8-3a4d-4032-bce3-a15359d2e9ef` |

### 485 — sim 0.82 len 0.97

Key: `20251029memowavesphase12`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251029_Memo Waves_Phase 12.docx | KLP | legal | unknown | 80 | 217 | 902452ec8d19830b | 2026-04-12T12:11:40.279643+00:00 | `613865a2-96d9-491e-a4a2-cde0f338226d` |
| 2 | 20251029_Memo Waves_Phase 12.docx | KLP | legal | unknown | 80 | 202 | fb8950772ba204a3 | 2026-04-12T12:12:08.331737+00:00 | `2f02ef6e-fbb4-4094-b3af-f94101fbd85d` |

### 486 — sim 0.83 len 0.91

Key: `20251029tablaswaves`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251029 Tablas Waves.xlsx | KLP | legal | unknown | 80 | 38 | 62d6a0aff4c9f97c | 2026-04-12T12:11:59.752238+00:00 | `7c2493a3-540b-4feb-a363-87c5fa8882f8` |
| 2 | 20251029 Tablas Waves.xlsx | KLP | legal | unknown | 80 | 33 | 014c31fe4febecf7 | 2026-04-12T12:11:21.859104+00:00 | `6459bdc8-e627-4e0e-9fe7-be74772a3486` |

### 487 — sim 0.84 len 0.63

Key: `20260119tablaswavesphase17`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260119 Tablas Waves_Phase 17.xlsx | KLP | legal | unknown | 80 | 54 | 31942674354180d0 | 2026-04-12T12:19:55.680813+00:00 | `46323f8f-8cea-4218-b551-0606b995166d` |
| 2 | 20260119 Tablas Waves_Phase 17.xlsx | KLP | legal | unknown | 80 | 34 | b45be187a5a9cf0d | 2026-04-12T12:20:58.487391+00:00 | `017e4ed5-b790-4131-8d2b-f5d2ebbfb8bb` |

### 488 — sim 0.84 len 0.95

Key: `20250602seguimientoinfrasports`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250602 Seguimiento INFRASPORTS.xlsx | GVF | legal | unknown | 90 | 510 | e44066ec27d055ca | 2026-04-12T12:22:56.49277+00:00 | `a1fd303a-e373-4bf6-998b-156bdcb99892` |
| 2 | 20250602 Seguimiento INFRASPORTS.xlsx | GVF | legal | unknown | 90 | 485 | 15f44d217b98280f | 2026-04-12T12:25:01.303508+00:00 | `546cb327-f897-4be0-878b-611b3903ce8f` |

### 489 — sim 0.85 len 0.56

Key: `cartakelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | carta Kelpa.docx | KLP | legal | unknown | 90 | 9 | 2106cac4b5bd0a85 | 2026-04-12T12:07:49.423712+00:00 | `e2354d96-d286-4d3a-9eb9-60f4eec84395` |
| 2 | carta Kelpa.docx | KLP | legal | unknown | 90 | 5 | 06886f07b329aa02 | 2026-04-12T12:08:12.36842+00:00 | `068142f6-3361-4e17-b28e-99713c2feb07` |

### 490 — sim 0.86 len 0.76

Key: `paulbettelleyfurtheraddendum`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Paul Bettelley Further Addendum signed.pdf | BHX | legal | signed | 90 | 13 | 06429ccff7e6021c | 2026-04-11T19:49:15.241338+00:00 | `be0011a1-4944-4a3a-974d-cbdf488e49a1` |
| 2 | Paul Bettelley Further Addendum.pdf | BHX | legal | signed | 90 | 11 | 77db0124e1e4c91e | 2026-04-11T19:51:58.47151+00:00 | `aef794ab-f3d6-45ea-b574-ca34896734ef` |

### 491 — sim 0.86 len 0.89

Key: `20251216tablaswavesphase15`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251216 Tablas Waves Phase 15.xlsx | KLP | legal | unknown | 80 | 47 | 95b217c29293a0e7 | 2026-04-12T12:15:43.862655+00:00 | `a562bf8b-9a00-46b2-bf86-9ec147ecafc3` |
| 2 | 20251216 Tablas Waves Phase 15.xlsx | KLP | legal | unknown | 80 | 42 | e095e5159e869717 | 2026-04-12T12:16:31.742761+00:00 | `db05c7f0-8c43-42f2-8373-ad8534231a54` |

### 492 — sim 0.87 len 0.72

Key: `20250314memompsfase6`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250314_Memo MPS Fase 6.docx | KLP | legal | unknown | 80 | 122 | e4f2b51214a87ca2 | 2026-04-12T12:45:43.910732+00:00 | `4079376e-6c51-4c17-a022-bf1d88383242` |
| 2 | 20250314_Memo MPS Fase 6.docx | KLP | legal | unknown | 80 | 102 | ed4f4dd70d009033 | 2026-04-12T12:45:55.004706+00:00 | `1d5ecb1e-dea0-4f3b-b4a2-679d6ffa5cad` |

### 493 — sim 0.87 len 0.89

Key: `anexo07vigenciadedatos`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Anexo 07. Vigencia de datos signed.pdf | MAD | legal | executed | 95 | 1 | 5b7c8d5a15657d7c | 2026-04-12T12:28:43.285665+00:00 | `b1c60c4f-b4ce-4190-943f-a1467537a30d` |
| 2 | Anexo 07. Vigencia de datos.pdf | MAD | legal | unknown | 95 | 1 | 31db9d788ae53ec0 | 2026-04-12T12:28:44.548376+00:00 | `fd5e626b-2535-4ac4-8e15-c79e11d89c65` |

### 494 — sim 0.87 len 1.00

Key: `20260210memowavesphase21`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260210_Memo Waves_Phase 21.pdf | KLP | legal | unknown | 80 | 194 | 99a552fa983013a4 | 2026-04-12T12:34:10.94566+00:00 | `4ec06ea9-2c5c-4589-9424-ad32f35f9198` |
| 2 | 20260210_Memo Waves_Phase 21.pdf | KLP | legal | unknown | 80 | 189 | f3b6bbb06331072b | 2026-04-12T12:34:49.461432+00:00 | `f9b16254-b15a-4008-889a-ada6c2046d0d` |

### 495 — sim 0.88 len 0.92

Key: `20251217eiacuerdodesocios2146kelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251217_EI Acuerdo de socios_2146_Kelpa.pdf | GVF | legal | unknown | 90 | 177 | e47bc363a6f6299e | 2026-04-12T12:29:44.104405+00:00 | `837f0e4c-6d4d-4a9e-b231-918e7878f701` |
| 2 | 20251217_EI Acuerdo de socios_2146_Kelpa.pdf | GVF | legal | unknown | 90 | 166 | 8d3eec5986f84376 | 2026-04-12T12:31:07.284688+00:00 | `8dc059bb-fafb-4b44-98dd-8c4c4fe43883` |

### 496 — sim 0.89 len 0.93

Key: `20260119memowavesphase17`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260119_Memo Waves_Phase 17.docx | KLP | legal | unknown | 80 | 332 | 29dbb85e1de8555e | 2026-04-12T12:21:46.76658+00:00 | `e9003f9e-e8d3-4305-b4e3-f93be9b4b6d5` |
| 2 | 20260119_Memo Waves_Phase 17.docx | KLP | legal | unknown | 80 | 307 | 4166665fe5f7c1a3 | 2026-04-12T12:20:05.596672+00:00 | `3d749c39-8ead-4d15-a044-c22d2ae6be72` |

### 497 — sim 0.90 len 0.87

Key: `20250922eiaumentodecapitalsocial1601kelpa`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250922_EI Aumento de capital social_1601_Kelpa.pdf | GVF | legal | unknown | 90 | 313 | c984b9c00b9d8e73 | 2026-04-12T12:28:55.53821+00:00 | `088359ac-bdde-4ecb-8b6c-e7315d65fc1e` |
| 2 | 20250922_EI Aumento de capital social_1601_Kelpa.pdf | GVF | legal | unknown | 90 | 283 | b366b2b3b812547b | 2026-04-12T12:26:08.290284+00:00 | `71420118-c56f-47f4-9474-c1cfe1cf831a` |

### 498 — sim 0.90 len 0.99

Key: `stonewegcontratoratingprivadoparasan`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | STONEWEG_Contrato_Rating_Privado para SAN.pdf | KLP | legal | signed | 90 | 34 | 2db7e531cdc05926 | 2026-04-11T20:00:57.199632+00:00 | `6e4038bb-f522-4b75-bec4-88fb023cf650` |
| 2 | STONEWEG_Contrato_Rating_Privado para SAN.pdf | KLP | legal | executed | 90 | 34 | 438649156766697e | 2026-04-11T20:04:06.92759+00:00 | `40b7eacf-3379-436c-97f2-b9465e149f74` |

### 499 — sim 0.91 len 0.92

Key: `20260202tablaswavesphase19`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260202 Tablas Waves_Phase 19.xlsx | KLP | legal | unknown | 80 | 64 | a0d07eb94568d231 | 2026-04-12T12:25:37.529785+00:00 | `409cd7db-ec31-4ece-9aa3-d7b3938e04fa` |
| 2 | 20260202 Tablas Waves_Phase 19.xlsx | KLP | legal | unknown | 80 | 59 | 338f24d501df0022 | 2026-04-12T12:26:45.60326+00:00 | `a281a8d8-3951-4f9b-8e8e-7e4531d49ccc` |

### 500 — sim 0.92 len 0.88

Key: `lonabarcelonamemoria2023`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | LONA BARCELONA MEMORIA 2023.pdf | GVF | legal | unknown | 90 | 44 | 495661f07ba6cab8 | 2026-04-12T12:34:52.933923+00:00 | `e9fc731c-4016-4886-b5bd-c2f68e7cddfe` |
| 2 | LONA BARCELONA MEMORIA 2023.pdf | GVF | legal | unknown | 90 | 39 | 1365a58233aa78be | 2026-04-12T12:32:26.928941+00:00 | `277d2965-3858-4ffb-972f-095f6aac6ea1` |

### 501 — sim 0.92 len 0.90

Key: `20241227memompsfase4`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20241227_Memo MPS Fase 4.pdf | KLP | legal | unknown | 80 | 46 | 8c844a66aca0645f | 2026-04-12T12:43:51.706963+00:00 | `574dda3f-4b0d-481d-a1a5-3ecd8e3bde30` |
| 2 | 20241227_Memo MPS Fase 4.pdf | KLP | legal | unknown | 80 | 41 | 403c875fc5b50887 | 2026-04-12T12:43:40.552606+00:00 | `e2a212e6-77f1-482f-8d52-62c267e02706` |

### 502 — sim 0.92 len 0.95

Key: `madridplayasurfsl`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | MADRID PLAYA SURF SL signed.pdf | MAD | legal | signed | 90 | 2 | 7e74dc9a10825dd1 | 2026-04-12T11:28:12.871629+00:00 | `d92fd519-d495-4dfa-a9ae-444ac4cacb5b` |
| 2 | MADRID PLAYA SURF SL.pdf | MAD | legal | signed | 90 | 2 | e2acb1becccbb650 | 2026-04-12T11:28:42.83773+00:00 | `c2c2d4c1-2f64-451d-9a86-6e7bef79f038` |

### 503 — sim 0.93 len 0.89

Key: `202501propuestakpmgkelpav2`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 202501_Propuesta_KPMG-KELPA - V2.pdf | GVF | legal | unknown | 90 | 77 | 19e42df735d340bd | 2026-04-12T12:20:52.871913+00:00 | `6bdcc70d-7de7-493c-86c7-5b20290d6866` |
| 2 | 202501_Propuesta_KPMG-KELPA - V2.pdf | GVF | legal | unknown | 90 | 62 | 3253d56dc86e80e3 | 2026-04-12T12:22:05.554738+00:00 | `0cd885a5-29e2-4944-9311-140ea9063e6b` |

### 504 — sim 0.93 len 0.93

Key: `20260210memowavesphase20`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260210_Memo Waves_Phase 20.docx | KLP | legal | unknown | 80 | 402 | 3ddf5c4baa489aa9 | 2026-04-12T12:30:02.941049+00:00 | `9a90648d-b270-445c-a887-407b204959fb` |
| 2 | 20260210_Memo Waves_Phase 20.docx | KLP | legal | unknown | 80 | 397 | d4cffcb3561d07f9 | 2026-04-12T12:29:56.495023+00:00 | `89673315-b3a0-4c6b-bbb8-55fcc803810d` |

### 505 — sim 0.95 len 0.95

Key: `gsbrandingcesion`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | GS_BRANDING_CESIÓN SIGNED.pdf | GVF | legal | executed | 90 | 3 | 32a4534d807407f0 | 2026-04-12T12:20:47.07433+00:00 | `96b5d655-6d71-4c09-aa22-c609717a8c49` |
| 2 | GS_BRANDING_CESIÓN.pdf | GVF | legal | unknown | 90 | 3 | 0d6386d491e3c216 | 2026-04-12T12:20:48.555409+00:00 | `d7450e8c-3489-48f1-b3fe-e9d5a5baadeb` |

### 506 — sim 1.00 len 0.71

Key: `20251105memowavesphase13`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20251105_Memo Waves_Phase 13.docx | KLP | legal | unknown | 80 | 242 | 61ecbe8a71861aa7 | 2026-04-12T12:13:44.869585+00:00 | `1a70ea9c-5bef-4853-9890-84cab8688918` |
| 2 | 20251105_Memo Waves_Phase 13.docx | KLP | legal | unknown | 80 | 237 | 37d6a96033b764a7 | 2026-04-12T12:14:46.040028+00:00 | `5ef4f567-79d2-4141-92aa-e74fcc0c06c3` |

### 507 — sim 1.00 len 0.73

Key: `20260122memowavesphase18`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20260122_Memo Waves_Phase 18.docx | KLP | legal | unknown | 80 | 335 | 1cd63b86560479fe | 2026-04-12T12:23:46.58974+00:00 | `046a1b29-62c4-4e33-ae7c-2d3c18bf7464` |
| 2 | 20260122_Memo Waves_Phase 18.docx | KLP | legal | unknown | 80 | 330 | 7bcf9fe32d314fa8 | 2026-04-12T12:22:42.970027+00:00 | `0057f90a-da38-435e-884b-14aa7256b369` |

### 508 — sim 1.00 len 0.77

Key: `20250930memompsphase10`

| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | 20250930_Memo MPS_Phase 10.docx | KLP | legal | unknown | 80 | 180 | 8e3ccec809565e72 | 2026-04-12T12:08:02.360993+00:00 | `3c7e30d8-86aa-4f64-943b-f9be5419150a` |
| 2 | 20250930_Memo MPS_Phase 10.docx | KLP | legal | unknown | 80 | 170 | 213d5201ca99ab20 | 2026-04-12T12:08:46.313622+00:00 | `e27880ce-1f87-4255-8d1c-abaef1d1339d` |
