# Universa Crypto library, JS/TS

Extended crypto primitives of 4th generation Universa primitives used
in parsec and some other projects, namely secure e2e services. New primitives are

- UniversalKey: extends AbstractKey to better different keys interoperability and common interfaces
 
    - introduced more reliable and secure tags, derivable from passwords, from addresses of public keys or just random ids for symmetric keys, with smart serialization. 
    
    - Private/Public keys encryption is extended: now it is possible to encrypt any datam if it will not fit under the inner key space, the random symmetric key will be used and all the available space under assymetric key will be used too. Greatly improves encrypted data size for larger assymetric keys.
    
    - using password as 1st class keys, with automatic derivation and derived data caching
    
    - deriving multiple keys from a password seamlessly using cached derived data as need 
     
- Coffers: space-wise container for effective encryption of some data with any of multiple keys. Adding more keys to the coffer without preaking its content. Note, there is no need to sign coffer as UniversalKeys used to encrypt it all are used in ETA mode and guarantee contents integrity.

- Extended signer records

- Parsec simple and encrypted command de/encryptors

- Typescript friendly interfaces to universa low level objects (like BOSS, encoders, etc.)


> under construction, not ready for any evaluation.

## Licesnse 

MIT, see the repository.