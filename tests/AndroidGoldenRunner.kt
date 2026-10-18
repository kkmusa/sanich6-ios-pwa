import com.example.sanich.calculator.*
fun emit(kind:String, inputs:List<Any>, result:List<Any>?) {
 fun json(v:Any):String=if(v is String) "\"$v\"" else v.toString()
 println("{\"kind\":\"$kind\",\"inputs\":[${inputs.joinToString(","){json(it)}}],\"expected\":${result?.joinToString(",","[","]"){json(it)}?:"null"}}")
}
fun main(){
 for(depth in listOf(0.0,1000.0,1750.12))for(pz in listOf(0.0,10.0,30.0))for(pd in listOf(0.0,20.0,70.0))for(rho in listOf(.8,1.0,1.2))emit("level",listOf(depth,pz,pd,rho),listOf(LevelCalculator.calculate(depth,pz,pd,rho)))
 for(level in listOf(-392.4,-100.0,0.0,600.0,1200.0))for(head in listOf(500.0,1000.0,2000.0))emit("frequency",listOf(level,head),listOf(FrequencyCalculator.calculate(level,head)))
 for(t in listOf(60.0,73.0,89.0))for(c in listOf(139.7,146.0,168.0))for(w in listOf(6.5,8.5))emit("annular",listOf(t,c,w),runCatching{listOf(AnnularVolumeCalculator.volumePerMeter(t,c,w))}.getOrNull())
 for(c in listOf(114.0,146.0,168.0))for(w in listOf(6.5,8.5))emit("inner",listOf(c,w),listOf(AnnularVolumeCalculator.casingInnerDiameter(c,w)))
 for(p1 in listOf(10.0,20.0))for(p2 in listOf(15.0,30.0))for(a in listOf(0.0,5.0))for(r in listOf(.8,1.0))for(t in listOf(5.0,60.0))emit("sensor",listOf(1000.0,p1,p2,a,r,"168","73",.0136,t),listOf(FlowCalculator.sensorHermetic(1000.0,p1,p2,a,r,"168","73",.0136,t)))
 for(mode in listOf("hermetic","drain","afterDrain"))for(d in listOf(0.0,1.25,10.0,100.0))for(v in listOf(0.0,.0087,.0136))for(t in listOf(1.0,5.0,60.0)){
  val r=when(mode){"hermetic"->FlowCalculator.hermetic(d,v,t);"drain"->FlowCalculator.drain(d,v,.003,10.0,t);else->FlowCalculator.afterDrain(d,v,.003,t)}
  emit("flow",listOf(mode,d,v,t,.003,10.0),listOf(r))
 }
 for(variant in SkoVariant.entries)for(depth in listOf(100.0,1000.0,2000.0))for(tubing in listOf(.060,.073,.089)){
  val r=SkoCalculator.calculate(variant,depth,3.0,.129,tubing)
  emit("sko",listOf(variant.name,depth,3.0,.129,tubing),listOf(r.baseVolumeM3,r.additionalVolumeM3,r.treatmentVolumeM3))
 }
 for(mode in ControlStationMode.entries)for(material in CableMaterial.entries)for(motor in MotorType.entries)for(filter in listOf(false,true))for(temp in listOf(0.0,20.0,120.0)){
  val r=TapCalculator.calculate(mode,380.0,380.0,1000.0,20.0,1200.0,16.0,temp,material,motor,380.0,60.0,50.0,filter)
  emit("tap",listOf(mode.name,material.name,motor.name,filter,temp),listOf(r.temperatureCoefficient,r.voltageLoss,r.requiredVoltage))
 }
 for(q in listOf(50.0,100.0))for(p in listOf(0.0,25.0,50.0))for(s in listOf(0.0,1.0,10.0))for(c in listOf(60.0,120.0,360.0)){
  val result=runCatching{OperatingModeCalculator.toUpr(q,p,s,c)}.getOrNull()
  emit("upr",listOf(q,p,s,c),result?.let{listOf(it.productiveRunMinutes,it.totalRunMinutes,it.stopMinutes)})
 }
 for(p in listOf(0.0,50.0,75.0))for(s in listOf(0.0,1.0,10.0))for(d in listOf(0.0,1.0,60.0))for(c in listOf(60.0,120.0,360.0)){
  val r=OperatingModeCalculator.toApv(100.0,p,s,d,c)
  emit("apv",listOf(100.0,p,s,d,c),listOf(r.productiveRunMinutes,r.totalRunMinutes,r.requiredCycleBeforeRoundingMinutes,r.minimumRequiredCycleMinutes,r.stopMinutes,r.cycleIsSuitable))
 }
}
