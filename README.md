KAS Helper for Node
===================

This is a wrapper around `@keeer/kas-client` with a user model, for the ease of use in a typical monolithic Node + Koa + database web application.

## Install
```sh
npm i @keeer/kas-helper
```

## Usage
See `example/index.js`.

## API
### Class: KASHelper
#### KASHelper()
###### new KASHelper()
Creates a helper object. For accurate typings see the ts definition.

Parameters:

| Name           | Type     | Attributes | Description                                                               |
|:---------------|:---------|:-----------|:--------------------------------------------------------------------------|
| options.base   | string   |            | KAS base URL                                                              |
| options.upsert | function |            | the callback to upsert a user, signature: `async KASUser => any`          |
| options.get    | function |            | the callback to get a user, signature: `async (token: string) => KASUser` |
| options.token  | string   | <optional> | the service token for KAS, you need it if you want kiuid                  |

##### Methods
###### authenticate([kiuid]) → {KoaMiddleware}
Returns an authentication middleware, will set the user at `ctx.state.user`.

Parameters:

| Name  | Type    | Attributes | Default | Description                   |
|:------|:--------|:-----------|:--------|:------------------------------|
| kiuid | boolean | <optional> | false   | should we fetch the KEEER ID? |

Returns: KoaMiddleware

###### requireKeeerId([unauthorizedCallback]) → {KoaMiddleware}
Returns an middleware to call the callback if KEEER ID is not set in or next otherwise. Note: this middleware asserts that the user is already logged in. Failure of this assumption will lead to an error.

Parameters:

| Name                 | Type     | Attributes | Description                                                                               |
|:---------------------|:---------|:-----------|:------------------------------------------------------------------------------------------|
| unauthorizedCallback | function | <optional> | the function to call if no KEEER ID is set, defaults to redirect to the set KEEER ID page |

Returns: KoaMiddleware

###### requireKiuid() → {KoaMiddleware}
Returns an middleware to ensure that kiuid is set. Note: this middleware asserts that the user is already logged in. Failure of this assumption will lead to an error.

Returns: KoaMiddleware

###### requireLogin([unauthorizedCallback]) → {KoaMiddleware}
Returns an middleware to call the callback if not logged in or next otherwise.

Parameters:

| Name                 | Type     | Attributes | Description                                                             |
|:---------------------|:---------|:-----------|:------------------------------------------------------------------------|
| unauthorizedCallback | function | <optional> | the function to call if unauthorized, defaults to set the status to 400 |

Returns: KoaMiddleware

###### (async) userFromContext(ctx, [kiuid]) → {KASUser|null}
Gets the user from a given context.

Parameters:

| Name  | Type    | Attributes | Default | Description                   |
|:------|:--------|:-----------|:--------|:------------------------------|
| ctx   | any     |            |         | Koa context                   |
| kiuid | boolean | <optional> | false   | should we fetch the KEEER ID? |

Returns: KASUser | null, returns null if not logged in

###### (async) userFromToken(token, [kiuid]) → {KASUser|null}
Gets the user from a given token.

Parameters:

| Name  | Type    | Attributes | Default | Description                   |
|:------|:--------|:-----------|:--------|:------------------------------|
| token | string  |            |         | KAS account token             |
| kiuid | boolean | <optional> | false   | should we fetch the KEEER ID? |

Returns: KASUser | null, returns null if not logged in

### Class: KASUser
#### KASUser()
A user with a token.

##### Methods
###### (async) fetchKiuid() → {string}
Fetches kiuid and returns it.

Returns: string, kiuid

###### (async) pay(amount) → {boolean}
Let the user pay for something. This function will use KEEER ID to pay if it presents, or else it will use kiuid.

Parameters:

| Name   | Type   | Description                    |
|:-------|:-------|:-------------------------------|
| amount | number | Amount of centi-kredits to pay |

Returns: boolean, true for success, false for insufficient kredit

Throws: on other exceptions

###### (async) save()
Saves this user.
