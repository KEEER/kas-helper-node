declare type KASHelperClass =
  (new (options: { base: string, upsert (user: KASUserWithoutServiceToken): Promise<void>, get (token: string): Promise<KASUser | null> }) => KASHelper<KASUserWithoutServiceToken, never>) &
  (new (options: { base: string, token: string, upsert (user: KASUserWithServiceToken): Promise<void>, get (token: string): Promise<KASUserWithKiuid | null> }) => KASHelper<KASUserWithServiceToken, KoaMiddleware>)
declare const KASHelper: KASHelperClass
export = { KASHelper, KASUser: KASUserWithKiuid }

interface KASUser {
  readonly token: string
  readonly avatar?: string
  readonly nickname?: string
  readonly keeerId?: string
  readonly kredit: number
}
interface WithKiuid { readonly kiuid?: string }
interface KASUserWithKiuid extends KASUser, WithKiuid {}
interface Saveable { save (): Promise<void> }
interface KASUserWithoutServiceToken extends KASUser, Saveable {}
interface KASUserWithServiceToken extends KASUser, Saveable, WithKiuid {
  fetchKiuid (): Promise<string>
  pay (amount: number): Promise<boolean>
}
declare type KoaMiddleware = (ctx: any, next: () => Promise<void>) => Promise<void>
interface KASHelper<UserType, KiuidType> {
  readonly base: string
  userFromContext (ctx: any, kiuid: boolean): Promise<UserType>
  userFromToken (token: string, kiuid: boolean): Promise<UserType>
  authenticate (): KoaMiddleware
  authenticate (kiuid: false): KoaMiddleware
  authenticate (kiuid: true): KiuidType
  requireLogin (unauthorizedCallback: KoaMiddleware): KoaMiddleware
  requireKeeerId (unauthorizedCallback: KoaMiddleware): KoaMiddleware
  requireKiuid (): KiuidType
}
