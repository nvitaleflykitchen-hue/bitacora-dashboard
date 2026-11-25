import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { createPasswordChangeHandler } from './handler.mjs'
const url=Deno.env.get('SUPABASE_URL')!
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
Deno.serve(createPasswordChangeHandler({admin,url,anonKey:Deno.env.get('SUPABASE_ANON_KEY')!}))
