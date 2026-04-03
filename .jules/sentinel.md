## 2024-04-02 - [CSV Formula Injection Mitigation]
**Vulnerability:** CSV export lacked escaping for formula characters (=, +, -, @), creating a risk for CSV Injection when users downloaded the security reports and opened them in a spreadsheet application.
**Learning:** Even internal or low-risk data should be sanitized for external applications if the system supports CSV generation. Formula injection is commonly overlooked.
**Prevention:** Prefix any field that starts with =, +, -, @, or whitespace like tab/CR/LF with a single quote (') to force it to be treated as text.

## 2024-04-03 - [XSS via Single Quotes in Inline Script Interpolation]
**Vulnerability:** A Cross-Site Scripting (XSS) vulnerability was found in HTML template rendering. The application used `encodeURIComponent` to encode user inputs but interpolated them into inline `<script>` blocks inside single-quoted strings (e.g. `var qs = '${qs}';`). Since `encodeURIComponent` does not escape single quotes, an attacker could inject a single quote to break out of the string literal and execute arbitrary JavaScript.
**Learning:** `encodeURIComponent` is safe for HTML attributes (when quoted with `"` or even `'` usually, though in JS strings it's a completely different context) but it does not protect against JS string injection if the string is delimited by `'` because it leaves `'` unchanged.
**Prevention:** When injecting variables into inline JavaScript string literals, always explicitly escape the string delimiter (e.g., replacing `'` with `\'`) or avoid inline script interpolation by passing data through HTML `data-*` attributes.
