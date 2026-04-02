## 2024-04-02 - [CSV Formula Injection Mitigation]
**Vulnerability:** CSV export lacked escaping for formula characters (=, +, -, @), creating a risk for CSV Injection when users downloaded the security reports and opened them in a spreadsheet application.
**Learning:** Even internal or low-risk data should be sanitized for external applications if the system supports CSV generation. Formula injection is commonly overlooked.
**Prevention:** Prefix any field that starts with =, +, -, @, or whitespace like tab/CR/LF with a single quote (') to force it to be treated as text.
