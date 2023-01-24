# Python to TypeScript (rough approximation)

This is a Node.js library for converting Python code to TypeScript, **to
a rough approximation**. It is not meant to be a runnable port of a
Python library to TypeScript, that isn't really straightforward or
necessarily possible. Instead, imagine you are trying to port a Python
library to TypeScript. You need to copy the details of a function
implementation, changing syntax here and there from Python to
TypeScript. But that is really error prone, you can make lots of
mistakes. This library translates the common stuff from Python to
TypeScript, so you can then fine-tune it by hand, cutting out the
tedious work of changing the high-level syntax.

So this library is like an aid to your process of porting code from
Python to TypeScript, not a perfect translator. It just saves you some
time and avoids some tediousness.
