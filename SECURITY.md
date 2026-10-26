# Security policy

## Supported versions

Only the `main` branch and the site deployed from it receive fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through [GitHub private vulnerability reporting](https://github.com/Yggdrasill501/candidate_scanner/security/advisories/new). Include what you found, how to reproduce it and what an attacker could do with it. You will get a reply within 7 days, and we will tell you when a fix ships. We are happy to credit you in the advisory.

## What counts

- Anything that lets someone change or insert data shown on the site. The public site is meant to be strictly read-only.
- Exposure of data the project promises not to publish: birth dates, street addresses, personal identification numbers, or anything that identifies a visitor.
- Injection, SSRF or code execution in the web app or in the pipeline's handling of downloaded files.
- Leaked credentials in this repository or its history.

## What does not

- A fact you believe is wrong about a candidate. That is a [data correction](https://github.com/Yggdrasill501/candidate_scanner/issues/new?template=data_correction.yml), not a vulnerability.
- Rate limits, missing security headers without a demonstrated impact, or reports from automated scanners without a working proof of concept.
