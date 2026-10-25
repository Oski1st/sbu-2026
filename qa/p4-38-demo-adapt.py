"""P4-38 harness adaptation: point a legacy Search/Journey browser script at /demo instead of /.

PR #37 moves the original sample Search from `/` to `/demo` (the new `/` is the dated-timetable planner).
This rewrites only the root entry points; every other URL and every assertion is unchanged.
Usage: python3 -I qa/p4-38-demo-adapt.py <legacy-script.cjs> <adapted-output.cjs>
The adapted copy must live inside the candidate checkout (e.g. qa/_p438run/) so `require("playwright")` resolves.
"""
import sys

REPLACEMENTS = [
    ('base + "/")', 'base + "/demo")'),
    ('base + "/?', 'base + "/demo?'),
    ('`${base}/`', '`${base}/demo`'),
    ('`${base}/?', '`${base}/demo?'),
    ('path = "/")', 'path = "/demo")'),  # p4-25 open() default
    ('open(page, "/")', 'open(page, "/demo")'),  # p4-25
]
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
for old, new in REPLACEMENTS:
    n = text.count(old)
    if n:
        print(f"{old!r} -> {new!r}: {n}")
    text = text.replace(old, new)
open(dst, "w").write(text)
