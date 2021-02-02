# Universa Parsec Crypto library, JS/TS

The `uparsecjs` library implements parsec protocol primitives and full
featured parsec 1.x client. It is written in typescript but is fully accessible from
plain javascript.

[Parsec](https://kb.universablockchain.com/parsec_1_specifications/303#) is a
of PARanodally SECure command-based binary protocol that detects many attacks 
including certificate-based MITM over SSL and DNS spoofing, being completely immune to many SSL flaws and 
effectively work on plain `HTTP` what is recommended connection outside browser 
pages context, as SSL only slows parsec down not adding any extra security to it.

When running from browser page it is necessary to use https connections as browsers
know yet nothing about parsec and assume any `http` connections insecure, which,
in our case, is not true.

Note that parsec over http implementation in this package uses only a single 
`HTTP POST` endpoint with `form-multipart` encoded binary data, ad accepts binary
data as a result.

`uparsecjs` works in following environments:

- all modern desktop browsers (e.g. FireFox, Chrome/Chromium, Safari, Edge, etc)
- all modern mobile browsers (Chrome/Chromium. Samsung browser,Safari, etc)
- nodejs servers

It internally uses `unicrypto` library with `WASM` based fast cryptography written
in C, that let it works fairly well on smartphones. It is actively used in many
our projects, including PWAs and b2b integrations.

## Usage

For details, see [online documentation](https://kb.universablockchain.com/system/static/uparsecjs/index.html), 
recommented entry point is a [Session](https://kb.universablockchain.com/system/static/uparsecjs/classes/_parsecsession_.session.html)
class. Example code:

~~~ts
import { ParsecSessionStorage, RootConnection } from "./Parsec";

// First, we construct connection. Connection could use any transport, but
// this module provides only http as for now:
const rootConnection = new RootConnection("http://parsec.your.host/api/p1");

// Implement parsec session storage to safely keep parsec session information
// between restarts. It should be encrypted and protected with password, or
// should doscard data on application exit, though it will cause to session re-
// establishing that takes a lot of time without stored parameters:
const storage: ParsecSessionStorage = new SomeProtectedStorage()

// Let session known the list of available addresses of the serivce, as for 1.1:
const addressProvider = (refresh: boolean) => {
  // in real life we might respect refresh value and provide more than one 
  // address.
  return [
    decode64("EMbhPh0J22t0EfITdXOhHnB2HKW9oBqxsIbWU7iBzGO4/N20x833lL527PBvV/ZSUnROnqs=")
  ];
}

// With connection, we can build se 
const session = new Session(storage, rootConnection, addressProvider);

// Now we can execute parsec commands:
const result = await session.call("myCommand", {foo: 'bar', buzz: 42});
~~~

We try to self-document all parts as much as possible.

## Licesnse 

MIT, see the repository.