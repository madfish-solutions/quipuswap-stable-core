# Rapid tests for Quipuswap Stable

Engaging Michelson interpreter to quickly check math soundness for Quipuswap.
Powered by PyTezos.

## Prerequisites

Install cryptographic libraries according to your system following the instrucitons here:
https://pytezos.org/quick_start.html#requirements

## Install requirements

```
python3 -m pip install pytezos
```

## Build Contracts
```
yarn compile
```

## Engage
From the root folder
```
python3 -m pytest . -v -s
```
