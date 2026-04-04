## 2024-04-02 - [CSV Formula Injection Mitigation]
**Vulnerability:** CSV export lacked escaping for formula characters (=, +, -, @), creating a risk for CSV Injection when users downloaded the security reports and opened them in a spreadsheet application.
**Learning:** Even internal or low-risk data should be sanitized for external applications if the system supports CSV generation. Formula injection is commonly overlooked.
**Prevention:** Prefix any field that starts with =, +, -, @, or whitespace like tab/CR/LF with a single quote (') to force it to be treated as text.

## 2024-05-19 - [XSS via Single Quotes in encodeURIComponent]
**Vulnerability:** Inline JavaScript tags interpolating URL encoded query strings (`var qs = '${qs}'`) were vulnerable to XSS. `encodeURIComponent` does not encode the single quote (`'`), meaning malicious query parameters could break out of the string boundary.
**Learning:** Standard JavaScript `encodeURIComponent` is not sufficient for sanitizing input used within inline script tag contexts where strings are enclosed in single quotes.
**Prevention:** Explicitly escape or URL-encode single quotes (`.replace(/'/g, "%27")`) if using `encodeURIComponent` outputs inside single-quoted strings within HTML `<script>` tags.
