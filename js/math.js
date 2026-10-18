const DngMath=Object.freeze({
 liquidLevel(d,z,p,rho){return [d,z,p,rho].every(Number.isFinite)&&rho>0?d-((p-z)*10)/(rho/1000):null},
 startFrequency(l,h){if(![l,h].every(Number.isFinite)||h<=0)return null;const r=50*Math.sqrt((40*9.81+l)/h);return Number.isFinite(r)?r:null},
 intervalMinutes(startDay,startHour,startMinute,endHour,endMinute){
 const values=[startDay,startHour,startMinute,endHour,endMinute];
 if(!values.every(Number.isInteger)||![0,1].includes(startDay)||startHour<0||startHour>23||endHour<0||endHour>23||startMinute<0||startMinute>59||endMinute<0||endMinute>59)return null;
 const duration=1440*(1-startDay)+endHour*60+endMinute-(startHour*60+startMinute);
 return duration>0&&duration<=2880?duration:null;
 },
 manualDebitInterval(liters,minutes){return [liters,minutes].every(Number.isFinite)&&liters>0&&minutes>0?liters*1.44/minutes:null},
 manualDebit(l,s){return [l,s].every(Number.isFinite)&&l>0&&s>0?l*86.4/s:null},
 operatingCycle(q,p,s,c){if(![q,p,s,c].every(Number.isFinite)||q<=0||p<0||s<0||c<=0)return null;const productive=c*p/q,total=productive+s;return {productive,total,stop:c-total}},
 apvMinimumCycle(q,p,s,dr){return [q,p,s,dr].every(Number.isFinite)&&q>0&&p>=0&&p<q&&s>=0&&dr>=0?Math.ceil(((s+dr)/(1-p/q))/60)*60:null}
});
if(typeof module!=='undefined'&&module.exports)module.exports=DngMath;
