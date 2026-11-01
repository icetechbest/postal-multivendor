URL="${1:-https://postal-multivendor-production.up.railway.app/graphql}"
{ echo "const gql=(s,...v)=>s.reduce((a,x,i)=>a+x+(v[i]??''),'');"; grep -v "^import " src/apollo/queries.js; } > .probe-queries.mjs
URL="$URL" node --input-type=module -e "
import * as q from './.probe-queries.mjs';
const url=process.env.URL;
const vars={latitude:30.4183,longitude:31.56,shopType:null};
const tests={
  restaurantListPreview:[q.restaurantListPreview,vars],
  restaurantList:[q.restaurantList,vars],
  getBanners:[q.getBanners,{}],
  getCuisines:[q.getCuisines,{}],
  getZones:[q.getZones,{}],
  getConfiguration:[q.getConfiguration,{}],
};
for (const [name,[query,variables]] of Object.entries(tests)) {
  if(!query){console.log('SKIP',name,'(not exported)');continue}
  const t=Date.now();
  try{
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables})});
    const j=await r.json(); const ms=Date.now()-t;
    if(j.errors) console.log('FAIL',name,ms+'ms','->',j.errors.slice(0,3).map(e=>e.message).join(' | '));
    else console.log('OK  ',name,ms+'ms');
  }catch(e){console.log('ERR ',name,(Date.now()-t)+'ms',e.message)}
}
"
rm -f .probe-queries.mjs
