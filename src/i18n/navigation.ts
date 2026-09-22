import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/*
 * `Link`, `redirect` y compañía con el idioma puesto. Se usan en lugar de los
 * de Next para que un link nunca tire a alguien de vuelta al castellano.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
