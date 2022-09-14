# Code Style

## Code Formatter

If you want to contribute to this repository please use the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) code formatter.

## Functions

All functions should be lowerCamelCase.

### Comparison Functions

The format for a function which compares two objects of type XXXX.

It is a true/false comparison, not a fuzzy one.

```typescript
private compareInstanceInfo(instanceOne: InstanceInfo, instanceTwo: InstanceInfo): boolean
```

### Get Functions

The format for a function which gets or calculates data about an object.

The name should be `getXxYy()` where `Xx` is the object type and `Yy` is the property.
It can deviate from this however.

If the function references the abcFile; the `useSource` parameter determines whether to use the source or changed abc file to get relevant data and should default to true.

```typescript
private getInstanceName(instance: InstanceInfo, useSource: boolean = true): string
```
