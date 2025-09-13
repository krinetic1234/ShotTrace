import type { Gunshot, Mic } from "./types";

export const mics: Mic[] = [
  {
    micId: "1",
    lng: -71.08372488708355,
    lat: 42.348665779588, 
  }, // (0,0)
  {
    micId: "2",
    lng: -71.07566610610223 ,
    lat: 42.34866577958835, 
  }, // (6,0)
  {
    micId: "3",
    lng:-71.07969549659289 ,
    lat: 42.35165470337558, 
  }, // (3,3)
];

export const gunshot: Gunshot = {
    id: "1",
    lat: 42.34999542085064, 
    lng: -71.07969549659289,
    t: 1726233600000,
};