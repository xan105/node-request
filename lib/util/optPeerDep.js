import { isStringNotEmpty } from "@xan105/is/type";
import { Failure } from "./error.js";

async function load(name){
  
  if (!isStringNotEmpty(name)) 
    throw new Failure("Expecting a non empty string as module name", "ERR_INVALID_ARGS");
 
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