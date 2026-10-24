import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origin=Deno.env.get('SITE_ORIGIN');
const headers={'Access-Control-Allow-Origin':origin||'https://reallikram.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function remove(rows:any[]){for(const row of rows){const paths=[row.camera_path,row.screen_path].filter(Boolean);if(paths.length){const {error}=await admin.storage.from('captures').remove(paths);if(error)throw error;}const {error}=await admin.from('visits').delete().eq('id',row.id);if(error)throw error;}}
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.headers.get('origin')!==headers['Access-Control-Allow-Origin'])return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
 // Bound request size before parsing or base64 decoding.
 const reader=req.body?.getReader();if(!reader)return reply({error:'Missing body'},400);
 let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>5600000){await reader.cancel();return reply({error:'Submission too large'},413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const body=JSON.parse(new TextDecoder().decode(bytes));
 // Expired submissions become inaccessible through RLS at 30 days; reclaim on traffic.
 const {data:expired,error:expirationError}=await admin.from('visits').select('id,camera_path,screen_path').lt('expires_at',new Date().toISOString()).limit(100);
 if(expirationError)throw expirationError;if(expired?.length)await remove(expired);
 if(body.action==='delete'){
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Invalid deletion link'},400);
  const {data,error}=await admin.from('visits').select('id,camera_path,screen_path').eq('deletion_hash',await hash(body.token));if(error)throw error;await remove(data||[]);return reply({deleted:true});
 }
 if(body.action==='owner-delete'){
  const jwt=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
  const {data:{user},error}=await admin.auth.getUser(jwt);if(error||!user)return reply({error:'Unauthorized'},401);
  const {data:owner}=await admin.from('owners').select('user_id').eq('user_id',user.id).maybeSingle();if(!owner)return reply({error:'Forbidden'},403);
  const {data,error:queryError}=await admin.from('visits').select('id,camera_path,screen_path').eq('id',body.id);if(queryError)throw queryError;await remove(data||[]);return reply({deleted:true});
 }
 if(body.action||body.consent!==true||body.consentVersion!=='2026-10-24'||typeof body.device!=='string'||body.device.length>1000)return reply({error:'Valid consent and device information required'},400);
 let location=null;if(body.location){const {latitude,longitude}=body.location;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return reply({error:'Invalid location'},400);location={latitude:Math.round(latitude*10)/10,longitude:Math.round(longitude*10)/10};}
 const images:Record<string,Uint8Array>={};for(const kind of ['camera','screen'])if(body.photos?.[kind]){const image=body.photos[kind];if(typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:'JPEG images required'},400);const binary=atob(image.split(',')[1]);if(binary.length>2000000)return reply({error:'Image too large'},413);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply({error:'Invalid JPEG'},400);images[kind]=bytes;}
 const id=crypto.randomUUID(), token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const uploaded:string[]=[];try{for(const [kind,bytes]of Object.entries(images)){const path=`${id}/${kind}.jpg`;const {error}=await admin.storage.from('captures').upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(error)throw error;uploaded.push(path);}
 // This is the address reported by the hosting gateway, not verified identity.
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0,100)||null;
 const {error}=await admin.from('visits').insert({id,ip,device:body.device,location,consent_version:body.consentVersion,deletion_hash:await hash(token),camera_path:images.camera?`${id}/camera.jpg`:null,screen_path:images.screen?`${id}/screen.jpg`:null});if(error)throw error;
 }catch(error){if(uploaded.length)await admin.storage.from('captures').remove(uploaded);throw error;}
 return reply({deletionToken:token},201);
 }catch{return reply({error:'Request could not be processed'},400);}
});
