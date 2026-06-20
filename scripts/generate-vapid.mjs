import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve:'prime256v1' })
const publicJwk = publicKey.export({ format:'jwk' })
const privateJwk = privateKey.export({ format:'jwk' })

const decode = value => Buffer.from(value, 'base64url')
const vapidPublic = Buffer.concat([Buffer.from([4]), decode(publicJwk.x), decode(publicJwk.y)]).toString('base64url')

console.log('VITE_VAPID_PUBLIC_KEY=' + vapidPublic)
console.log('VAPID_PUBLIC_KEY=' + vapidPublic)
console.log('VAPID_PRIVATE_KEY=' + privateJwk.d)
console.log('VAPID_SUBJECT=mailto:admin@flykitchen.com.ar')
