# eslint-descriptive

## Description
`eslint-descriptive` is a plugin for typescript that copies many rules from [eslint](https://eslint.org/docs/latest/rules/) and [typescript-eslint](https://typescript-eslint.io/rules/) but adds reasoning for each rule in their error messages.

## Installation
#### npm
```shell
npm install eslint-descriptive --save-dev
```
#### yarn
```shell
yarn add -D eslint-descriptive
```

## Usage
Once installed, you can enable `eslint-descriptive` in your `.eslintrc.js`:

```json
{
    "extends": [
        "eslint-descriptive"
    ]
}
```
or for flat file config:
```javascript
import descriptive from "eslint-descriptive";
export default [{
    plugins: {
        "eslint-descriptive": descriptive,
    },
    rules: {
        ...descriptive.configs.all.rules,
        "eslint-descriptive/no-console": "off", // manually disable a rule
    }
}]
```

## Rules
You can view all the possible rules in the [config](./configs/all.js).
These are culled from `eslint:recommended`, `@typescript-eslint/recommended`, and `@typescript-eslint/stylistic` (with a few removed).
*Currently, these rules are NOT explicitly disabled in the `eslint-descriptive:all` configuration, so beware when also including the base rules!*
To see full rule descriptions, please look on the official [eslint](https://eslint.org/docs/latest/rules/) and [typescript-eslint](https://typescript-eslint.io/rules/) documentation.
Note that `eslint-descriptive` does NOT add or modify any rules, apart from adding descriptive reasoning to error messages.
It also uses discouraged features of `eslint` and `typescript-eslint` so use at your own risk!

## Contributing

* To deploy a new version (need to be a part of the `@ubccpsc310` npm organization (https://npmjs.com/settings/ubccpsc310/members)):
  1. Update version number in `package.json`
  2. `npm publish --access public`

## License
`eslint-descriptive` is licensed under the [ISC License](https://opensource.org/licenses/ISC).
