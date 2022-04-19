import { shouldStringNotEmpty } from "@xan105/is/assert";

async function load(name){
  
  shouldStringNotEmpty(name); 
 
  let module;
  
  try {
    module = (await import(name)).default;
    if (!module) module = null;
  } catch {
    module = null;
  }
  
  return module;
}

export { load };