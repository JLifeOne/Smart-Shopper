# Known Development Warnings

## `@babel/runtime` helper export warning

While running the Expo development client you may see:

```
Attempted to import the module ".../@babel/runtime/helpers/callSuper"
which is not listed in the "exports" of "@babel/runtime" under the requested subpath "./helpers/callSuper".
```

This originates from upstream Expo/Metro packages and is safe to ignore for now.  
A follow-up issue has been filed so we can pick up the fix once it lands in the Expo toolchain.

## WatermelonDB “JSI SQLiteAdapter not available…”

This warning appears when the app is running with remote debugging enabled.  
Disable remote debugging or use the native Hermes runtime to take advantage of the JSI adapter.
