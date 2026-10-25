import {expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {BookingHandoff, bookingFields} from "./BookingHandoff";
import type {ScheduledLeg} from "../../services/transit/timetables";
const leg: ScheduledLeg = {
  instance:"fixture",feed:"amtrak",operator:"AMTRAK",tripId:"99",routeId:"northeast",
  serviceDate:"2026-10-25",route:"Northeast Regional",number:"99",agencyName:"Amtrak",mode:"rail",
  fromStop:"amtrak:BBY",toStop:"amtrak:PHL",
  from:{id:"BBY",feed:"amtrak",name:"Back Bay",timezone:"America/New_York",url:"https://www.amtrak.com/stations/bby"},
  to:{id:"PHL",feed:"amtrak",name:"Philadelphia",timezone:"America/New_York",url:"https://www.amtrak.com/stations/phl"},
  departure:"2026-10-26T04:25:00Z",arrival:"2026-10-26T10:00:00Z",
  sourceUrl:"https://content.amtrak.com/content/gtfs/GTFS.zip",purchaseUrl:"https://www.amtrak.com/tickets.html"
};
it("copies operator fields using local boarding date, not the previous GTFS service day",()=>{
  expect(bookingFields(leg)).toEqual([
    {label:"From",value:"BBY"},{label:"To",value:"PHL"},{label:"Depart Date",value:"10/26/2026"},
    {label:"Departure time",value:"00:25"},{label:"Train number",value:"99"}
  ]);
});
it("keeps the correct local date across UTC midnight and DST offset changes",()=>{
  expect(bookingFields({...leg,departure:"2026-10-26T01:30:00Z"})[2].value).toBe("10/25/2026");
  expect(bookingFields({...leg,departure:"2026-11-01T06:30:00Z"})[3].value).toBe("01:30");
  expect(bookingFields({...leg,departure:"2026-10-26T04:30:00Z",from:{...leg.from,timezone:"America/Los_Angeles"}})[2].value).toBe("10/25/2026");
});
it("does not describe a general booking link as an exact train purchase",()=>{
 const h=renderToStaticMarkup(<BookingHandoff leg={leg}/>);
 expect(h).toContain("Exact ticket purchase links are not available");
 expect(h).toContain('value="BBY"');expect(h).toContain('value="PHL"');expect(h).toContain('value="10/26/2026"');
 expect(h).toContain("Copy Amtrak Depart Date");expect(h).toContain("does not preselect a train");
 expect(h).not.toContain("Official tickets");
});
it("LIRR directs to TrainTime with through-ticket guidance, not an Amtrak or reserved-seat claim",()=>{
 const h=renderToStaticMarkup(<BookingHandoff leg={{...leg,operator:"LIRR"}}/>);
 expect(h).toContain('href="https://www.mta.info/traintime"');expect(h).toContain("station/zone pairs");
 expect(h).toContain("one through ticket");expect(h).not.toContain("Copy Amtrak");
});
