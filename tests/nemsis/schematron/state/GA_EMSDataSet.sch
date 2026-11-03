<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="//nemsis.org/media/nemsis_v3/release-3.5.0/Schematron/utilities/html/schematronHtml.xsl"?><sch:schema xmlns:sch="http://purl.oclc.org/dsdl/schematron" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" queryBinding="xslt2" id="EMSDataSet" schemaVersion="3.5.0.251001CP6_GA260904" see="https://nemsis.org/technical-resources/version-3/version-3-schematron/">

  <sch:title>ISO schematron file for 3.5.0.251001CP6_EMSDataSet_3.5.0_Elite_Georgia. Updated 09/04/2026 by ImageTrend Admin.</sch:title>

  <sch:ns prefix="nem" uri="http://www.nemsis.org"/>
  <sch:ns prefix="xsi" uri="http://www.w3.org/2001/XMLSchema-instance"/>

  <!-- "Initialize" variables used by nemsisDiagnostic. -->
  <sch:let name="nemsisElements" value="()"/>
  <sch:let name="nemsisElementsMissing" value="''"/>
  <sch:let name="nemsisElementsMissingContext" value="()"/>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.01 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.01" />
			<sch:assert id="Rule_440" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.01 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.02) or nem:eTimes.01 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.03) or nem:eTimes.01 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.04) or nem:eTimes.01 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.05) or nem:eTimes.01 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.06) or nem:eTimes.01 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.07) or nem:eTimes.01 != '' and nem:eTimes.08 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.08) or nem:eTimes.01 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.09) or nem:eTimes.01 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.01 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.01 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.01 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.01 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.01 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.01 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.01) &gt; xs:dateTime(nem:eTimes.16))">PSAP appears to be out of sequence with other recorded date/time value(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eTimes.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eTimes">
				<sch:let name="nemsisElements" value="nem:eTimes.03"/>
				<sch:assert id="Rule_441" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.03 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.03) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.03 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.03) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.03 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.04) or nem:eTimes.03 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.05) or nem:eTimes.03 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.06) or nem:eTimes.03 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.07) or nem:eTimes.03 != '' and nem:eTimes.08 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.08) or nem:eTimes.03 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.09) or nem:eTimes.03 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.03 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.03 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.03 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.03 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.03 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.03 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime(nem:eTimes.16))">Unit Notified by Dispatch appears to be out of sequence with other recorded date/time value(s).</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.05 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.05" />
			<sch:assert id="Rule_442" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.05 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.05) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.05 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.05) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.05 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.05) &lt; xs:dateTime(nem:eTimes.03) or nem:eTimes.05 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.05) &lt; xs:dateTime(nem:eTimes.04) or nem:eTimes.05 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.06) or nem:eTimes.05 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.07) or nem:eTimes.05 != '' and nem:eTimes.08 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.08) or nem:eTimes.05 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.09) or nem:eTimes.05 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.05 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.05 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.05 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.05 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.05 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.05 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.05) &gt; xs:dateTime(nem:eTimes.16))">Unit En Route appears to be out of sequence with other recorded date/time value(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.06 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.06" />
			<sch:assert id="Rule_443" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.06 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.06 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.06 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.03) or nem:eTimes.06 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.04) or nem:eTimes.06 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.05) or nem:eTimes.06 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.07) or nem:eTimes.06 != '' and nem:eTimes.08 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.08) or nem:eTimes.06 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.09) or nem:eTimes.06 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.06 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.06 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.06 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.06 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.06 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.06 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.06 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.06) &gt; xs:dateTime(nem:eTimes.16))">Unit Arrived on Scene appears to be out of sequence with other recorded date/time value(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.07 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.07" />
			<sch:assert id="Rule_444" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.07 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.07 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.07 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.03) or nem:eTimes.07 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.04) or nem:eTimes.07 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.05) or nem:eTimes.07 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.07) &lt; xs:dateTime(nem:eTimes.06) or nem:eTimes.07 != '' and nem:eTimes.08 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.08) or nem:eTimes.07 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.09) or nem:eTimes.07 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.07 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.07 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.07 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.07 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.07 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.07 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.07) &gt; xs:dateTime(nem:eTimes.16))">Arrived at Patient appears to be out of sequence with other recorded date/time value(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.11" />
			<sch:assert id="Rule_445" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.11 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.11 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.11 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.03) or nem:eTimes.11 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.04) or nem:eTimes.11 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.05) or nem:eTimes.11 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.06) or nem:eTimes.11 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.07) or nem:eTimes.11 != '' and nem:eTimes.09 != '' and xs:dateTime(nem:eTimes.11) &lt; xs:dateTime(nem:eTimes.09) or nem:eTimes.11 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.11) &gt; xs:dateTime(nem:eTimes.16) or nem:eTimes.11 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.11) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.11 != '' and nem:eTimes.14 != '' and xs:dateTime(nem:eTimes.11) &gt; xs:dateTime(nem:eTimes.14) or nem:eTimes.11 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.11) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.11 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.11) &gt; xs:dateTime(nem:eTimes.12))">Patient Arrived at Destination appears to be out of sequence with other recorded date/time value(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eRecord.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eRecord">
				<sch:let name="nemsisElements" value="nem:eRecord.01"/>
				<sch:assert id="Rule_446" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eRecord.01) or nem:eRecord.01 = ''))">Patient Care Report Number is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse/nem:eResponse.ServiceGroup">
				<sch:let name="nemsisElements" value="nem:eResponse.05"/>
				<sch:assert id="Rule_447" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.05) or nem:eResponse.05 = ''))">Type of Service Requested is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.13"/>
				<sch:assert id="Rule_449" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.13) or nem:eResponse.13 = ''))">EMS Vehicle (Unit) Number is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.14 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.14"/>
				<sch:assert id="Rule_450" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.14) or nem:eResponse.14 = ''))">EMS Unit Call Sign is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.23 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.23"/>
				<sch:assert id="Rule_452" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.23) or nem:eResponse.23 = ''))">Response Mode to Scene is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.03 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.03" />
			<sch:assert id="Rule_454" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.03) or nem:eTimes.03 = ''))">Unit Notified by Dispatch Time is a mandatory field.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eTimes.13 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.13" />
			<sch:assert id="Rule_455" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.13) or nem:eTimes.13 = ''))">Unit Back in Service Time is a mandatory field.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.06 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.06" />
			<sch:assert id="Rule_457" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.06) or nem:eTimes.06 = '') and (nem:eTimes.09 and nem:eTimes.09 != ''))">Unit Arrived on Scene Time is a required field when Unit Left Scene is not blank.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.16 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.16"/>
				<sch:assert id="Rule_458" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.15 and nem:eArrest.15 != '') and (not(nem:eArrest.16) or nem:eArrest.16 = ''))">Reason must be given for discontinuing CPR/Resuscitation if Date/Time Resuscitation Discontinued is not blank.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eAirway.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eAirway/nem:eAirway.AirwayGroup/nem:eAirway.ConfirmationGroup">
				<sch:let name="nemsisElements" value="nem:eAirway.05"/>
				<sch:assert id="Rule_459" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(../nem:eAirway.01[text() = ('4001001', '4001003', '4001005', '4001007', '4001009', '4001011', '4001013')]) != 0 and nem:eAirway.03 = '4003003' and (not(nem:eAirway.05) or nem:eAirway.05 = ''))">Tube Depth Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.15"/>
				<sch:assert id="Rule_461" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.16 and nem:eArrest.16 != '') and (not(nem:eArrest.15) or nem:eArrest.15 = ''))">Date &amp; Time CPR Discontinued Not Documented when the Reason CPR/Resuscitation Discontinued is not blank.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eArrest.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.12" />
			<sch:assert id="Rule_498" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.12) or nem:eArrest.12 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Any Return of Spontaneous Circulation is required on all cardiac arrests.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.09"/>
				<sch:assert id="Rule_503" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eArrest.03[text() = ('3003003', '3003005')]) != 0) and (not(nem:eArrest.09) or nem:eArrest.09 = ''))">Type of CPR Provided is required when Resuscitation Attempted By EMS is (Attempted Ventilation or Initiated Chest Compressions)
	
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.06"/>
				<sch:assert id="Rule_516" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eInjury.06) or nem:eInjury.06 = '') and (count(nem:eInjury.01[text() = ('V29.9', 'V29.3', 'V30.9', 'V39.3', 'V39.9', 'V86.34', 'V86.99', 'V86.39', 'V81.9', 'V83.9', 'V84.9', 'V85.9', 'V86.31', 'V69.3', 'V69.9', 'V79.3', 'V79.9', 'V80.9', 'V49.9', 'V59.3', 'V59.9', 'V49.3')]) != 0))">Location of Patient in Vehicle Not Documented. This is required when patient is injured in a vehicle.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.07"/>
				<sch:assert id="Rule_517" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eInjury.01[text() = ('V29.9', 'V29.3', 'V30.9', 'V39.3', 'V39.9', 'V86.34', 'V49.9', 'V59.3', 'V59.9', 'V86.31', 'V69.3', 'V69.9', 'V79.3', 'V82.9', 'V79.9', 'V83.9', 'V84.9', 'V85.9', 'V80.9', 'V86.39', 'V86.92', 'V86.99', 'V81.9', 'V49.3')]) != 0) and (not(nem:eInjury.07) or nem:eInjury.07 = ''))">Use of Protective Devices Not Documented. This is required when patient is injured in a vehicle.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.08"/>
				<sch:assert id="Rule_518" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eInjury.05 and nem:eInjury.05 != '') and (not(nem:eInjury.08) or nem:eInjury.08 = ''))">Airbag Deployment Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProtocols.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProtocols/nem:eProtocols.ProtocolGroup">
				<sch:let name="nemsisElements" value="nem:eProtocols.02"/>
				<sch:assert id="Rule_527" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProtocols.01 and nem:eProtocols.01 != '') and (not(nem:eProtocols.02) or nem:eProtocols.02 = ''))">Protocol Age Category Not Documented. Please document when documenting a protocol.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.03"/>
				<sch:assert id="Rule_528" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.03) or nem:eResponse.03 = ''))">Document an Incident Number</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.04"/>
				<sch:assert id="Rule_529" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.04) or nem:eResponse.04 = '') and (not(nem:eResponse.04[@NV=('7701001')])))">EMS Response Number does not contain a Number or Not Applicable.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse/nem:eResponse.ServiceGroup">
				<sch:let name="nemsisElements" value="nem:eResponse.05"/>
				<sch:assert id="Rule_530" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.05) or nem:eResponse.05 = ''))">Type of Service Requested Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.09"/>
				<sch:assert id="Rule_533" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eResponse.09[text() = '2209011']) != 0 and (count(nem:eResponse.09[text() = ('2209001', '2209003', '2209005', '2209007', '2209033', '2209009', '2209031', '2209013', '2209015', '2209017', '2209019', '2209021', '2209023', '2209025', '2209027', '2209029')]) != 0))">When None/NoDelay is Selected No Other Type of Response Delay Can be Included</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.10 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.10"/>
				<sch:assert id="Rule_534" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eResponse.10[@NV = '7701001'] and ../nem:eTimes/nem:eTimes.06 != '' and ../nem:eTimes/nem:eTimes.09 != '' and (abs(days-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.09))) * 1440) + (abs(hours-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.09))) * 60) + (abs(minutes-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.09)))) &gt; 10)">Type of Scene Delay cannot be Not Applicable when scene time is greater than 10 minutes.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.11"/>
				<sch:assert id="Rule_535" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eResponse.11[text() = '2211011']) != 0 and (count(nem:eResponse.11[text() = ('2211001', '2211003', '2211005', '2211007', '2211009', '2211013', '2211031', '2211015', '2211017', '2211019', '2211021', '2211023', '2211025', '2211027', '2211029')]) != 0))">When None/No Delay is Selected No Other Type of Transport Delay can be Selected</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.12"/>
				<sch:assert id="Rule_536" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eResponse.12[text() = '2212015']) != 0 and (count(nem:eResponse.12[text() = ('2212001', '2212003', '2212005', '2212009', '2212033', '2212011', '2212017', '2212019', '2212021', '2212023', '2212025', '2212027', '2212029', '2212031', '2212013', '2212007')]) != 0))">When None/No Delay is Selected No Other Type of Turn-Around Delay Can be Selected</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.24 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.24"/>
				<sch:assert id="Rule_537" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eResponse.23 = ('2223003', '2223007') and (not(nem:eResponse.24) or nem:eResponse.24 = ''))">Additional Response Mode Descriptors is required when response mode to scene is Selected</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.07"/>
				<sch:assert id="Rule_540" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eScene.06 = '2707001' and (not(nem:eScene.07) or nem:eScene.07 = ''))">Document Mass Casualty Incident when multiple patients are selected.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.08"/>
				<sch:assert id="Rule_541" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eScene.07 = '9923003' and (not(nem:eScene.08) or nem:eScene.08 = ''))">Select Triage Classification for MCI Patient when indicating this was an MCI.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.01"/>
				<sch:assert id="Rule_545" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.01) or nem:eSituation.01 = '') and (not(nem:eSituation.09) or nem:eSituation.09 = '' or (not(nem:eSituation.09 = ('Z00.00', 'Z00.129')))) and (nem:eSituation.09 and nem:eSituation.09 != ''))">Document Date/Time of Symptom Onset is required when Primary Symptom is present</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.05 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.05" />
			<sch:assert id="Rule_551" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eTimes.03 and nem:eTimes.03 != '') and (not(nem:eTimes.05) or nem:eTimes.05 = ''))">Unit En Route
Date/Time Not Documented</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.06 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.06" />
			<sch:assert id="Rule_552" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eTimes.05 and nem:eTimes.05 != '') and nem:eTimes.06 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.06) &lt; xs:dateTime(nem:eTimes.05))">Unit Arrived 
on Scene Date/Time is before Unit En Route Date/Time </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.12" />
			<sch:assert id="Rule_556" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eTimes.11 and nem:eTimes.11 != '') and nem:eTimes.12 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.12) &lt; xs:dateTime(nem:eTimes.11))">Healthcare Facility Patient Transfer Date/Time is before Patient Arrived Date/Time </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.15"/>
				<sch:assert id="Rule_557" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.14 and nem:eVitals.14 != '') and (not(nem:eVitals.15) or nem:eVitals.15 = ''))">Document Respiratory Effort when documenting respiratory rate </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.10 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.10"/>
				<sch:assert id="Rule_559" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.01 and nem:eProcedures.01 != '') and (not(nem:eProcedures.10) or nem:eProcedures.10 = '') and nem:eProcedures.02 = '9923001')">Role/Type of Person Performing the Procedure is required when performing procedure</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.05"/>
				<sch:assert id="Rule_564" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eProcedures.03[@PN])) and (nem:eProcedures.03 and nem:eProcedures.03 != '') and (not(nem:eProcedures.05) or nem:eProcedures.05 = '') and nem:eProcedures.05[@NV != '7701001'] and nem:eProcedures.02 = '9923001')">Number of Procedure Attempts Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eRecord.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eRecord/nem:eRecord.SoftwareApplicationGroup">
				<sch:let name="nemsisElements" value="nem:eRecord.02"/>
				<sch:assert id="Rule_565" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eRecord.02) or nem:eRecord.02 = ''))">Software Creator Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eRecord.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eRecord/nem:eRecord.SoftwareApplicationGroup">
				<sch:let name="nemsisElements" value="nem:eRecord.03"/>
				<sch:assert id="Rule_566" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eRecord.03) or nem:eRecord.03 = ''))">Software Name Not Documented
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eRecord.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eRecord/nem:eRecord.SoftwareApplicationGroup">
				<sch:let name="nemsisElements" value="nem:eRecord.04"/>
				<sch:assert id="Rule_567" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eRecord.04) or nem:eRecord.04 = ''))">Software Version Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.02"/>
				<sch:assert id="Rule_571" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eVitals.02) or nem:eVitals.02 = '' or (not(nem:eVitals.02 = ('9923001', '9923003')))) and (nem:eVitals.01 and nem:eVitals.01 != ''))">Vitals Obtained Prior to this Units EMS Care Not Documented
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.CardiacRhythmGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.05"/>
				<sch:assert id="Rule_572" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.03 and nem:eVitals.03 != '') and (not(nem:eVitals.05) or nem:eVitals.05 = ''))">Method of ECG Interpretation Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.06"/>
				<sch:assert id="Rule_573" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eVitals.08 = ('3308001', '3308005', '3308007', '3308009', '3308003', '3308011') and (not(nem:eVitals.06) or nem:eVitals.06 = '') and (not(nem:eVitals.06[@PN])))">Document SBP (Systolic Blood Pressure) OR Select a Pertinent Negative </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.08"/>
				<sch:assert id="Rule_576" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.06 and nem:eVitals.06 != '') and (not(nem:eVitals.08) or nem:eVitals.08 = ''))">Document Method of Blood Pressure Measurement</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.01"/>
				<sch:assert id="Rule_599" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eProcedures.01) or nem:eProcedures.01 = '') and (nem:eProcedures.03 and nem:eProcedures.03 != '') and nem:eProcedures.02 = '9923001')">Date/Time Procedure Performed Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.03"/>
				<sch:assert id="Rule_600" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.01 and nem:eProcedures.01 != '') and (not(nem:eProcedures.03) or nem:eProcedures.03 = ''))">When Date/Time Procedure Performed is documented a procedure is required.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.09"/>
				<sch:assert id="Rule_601" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eResponse.09[@NV = '7701001'] and ../nem:eTimes/nem:eTimes.06 != '' and ../nem:eTimes/nem:eTimes.03 != '' and (abs(days-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.03))) * 1440) + (abs(hours-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.03))) * 60) + (abs(minutes-from-duration(xs:dateTime(../nem:eTimes/nem:eTimes.06) - xs:dateTime(../nem:eTimes/nem:eTimes.03)))) &gt; 0)">Type of Response Delay is required when Unit Notified by Dispatch to Unit Arrived on Scene is greater than "0". </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.CardiacRhythmGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.04"/>
				<sch:assert id="Rule_603" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.03 and nem:eVitals.03 != '') and (not(nem:eVitals.04) or nem:eVitals.04 = ''))">ECG Type is required when documenting ECG. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.23 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.GlasgowScoreGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.23"/>
				<sch:assert id="Rule_606" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.19 and nem:eVitals.19 != '') and (nem:eVitals.20 and nem:eVitals.20 != '') and (nem:eVitals.21 and nem:eVitals.21 != '') and (not(nem:eVitals.23) or nem:eVitals.23 = ''))">Document Total Glasgow Coma Score when documenting part of GCS</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.05"/>
				<sch:assert id="Rule_608" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eInjury.01[text() = ('V29.9', 'V29.3', 'V30.9', 'V39.3', 'V49.9', 'V59.3', 'V59.9', 'V69.3', 'V69.9', 'V79.3', 'V79.9', 'V80.9', 'V81.9', 'V83.9', 'V84.9', 'V85.9', 'V86.31', 'V86.34', 'V86.39', 'V86.92', 'V86.99', 'V49.3')]) != 0) and (not(nem:eInjury.05) or nem:eInjury.05 = ''))">Main Area of Vehicle Impacted by a Collision is required. EX: 12 = front, 3 = passenger (right) side, 6 = rear, etc. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.09"/>
				<sch:assert id="Rule_609" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eInjury.01[text() = ('W00.9', 'W01', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10.9', 'W11', 'W12', 'W13.2', 'W13.4', 'W14', 'W15', 'W16', 'W17', 'W18', 'W18.1', 'W18.2', 'W18.4', 'X80', 'Y01')]) != 0) and (not(nem:eInjury.09) or nem:eInjury.09 = ''))">Height of Fall is required when the Cause of Injury is Fall.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse/nem:eResponse.AgencyGroup">
				<sch:let name="nemsisElements" value="nem:eResponse.01"/>
				<sch:assert id="Rule_613" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.01) or nem:eResponse.01 = ''))">EMS Agency Number Must Be Completed</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.07"/>
				<sch:assert id="Rule_827" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eVitals.07) or nem:eVitals.07 = '') and (nem:eVitals.06 and nem:eVitals.06 != '') and nem:eVitals.08 != '3308009' and (not(nem:eVitals.07[@PN=('8801005', '8801023')])))">Diastolic BP is required when SBP entered and method is not by palpation. Enter valid DBP or select Pertinent Negative, or select Cuff-Manual Palpated.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.CrewGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport">
				<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup"/>
				<sch:assert id="Rule_844" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(not(nem:eCrew) or count(nem:eCrew/nem:eCrew.CrewGroup) = 0)">Crew Members must be documented.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eAirway.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eAirway/nem:eAirway.AirwayGroup">
				<sch:let name="nemsisElements" value="nem:eAirway.09"/>
				<sch:assert id="Rule_867" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eAirway.08[text() = '4008011']) != 0 and (not(nem:eAirway.09) or nem:eAirway.09 = ''))">Suspected Reasons for Failed Airway Procedure Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.09 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.09" />
			<sch:assert id="Rule_872" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.09 != '' and nem:eTimes.01 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.01) or nem:eTimes.09 != '' and nem:eTimes.02 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.02) or nem:eTimes.09 != '' and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.03) or nem:eTimes.09 != '' and nem:eTimes.04 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.04) or nem:eTimes.09 != '' and nem:eTimes.05 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.05) or nem:eTimes.09 != '' and nem:eTimes.06 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.06) or nem:eTimes.09 != '' and nem:eTimes.07 != '' and xs:dateTime(nem:eTimes.09) &lt; xs:dateTime(nem:eTimes.07) or nem:eTimes.09 != '' and nem:eTimes.10 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.10) or nem:eTimes.09 != '' and nem:eTimes.11 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.11) or nem:eTimes.09 != '' and nem:eTimes.12 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.12) or nem:eTimes.09 != '' and nem:eTimes.13 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.13) or nem:eTimes.09 != '' and nem:eTimes.15 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.15) or nem:eTimes.09 != '' and nem:eTimes.16 != '' and xs:dateTime(nem:eTimes.09) &gt; xs:dateTime(nem:eTimes.16))">Unit Left Scene Date/Time appears to be out of sequence with other recorded date/time values(s).</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_878" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and (nem:eArrest.02 and nem:eArrest.02 != ''))">Cardiac Arrest Indicator cannot be No When Cardiac Arrest Etiology Given.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_879" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and (count(nem:eArrest.17[text() = ('9901003', '9901035', '9901067', '9901071', '9901065', '9901063')]) != 0))">Cardiac Arrest Indicator  cannot be No When Rhythm at Destination has Arrest Rhythm </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.09"/>
				<sch:assert id="Rule_882" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eScene.09) or nem:eScene.09 = ''))">Incident Location Type must be documented on all arrests.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_883" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.01 = '3001001') and (../nem:eSituation/nem:eSituation.11 = 'I46.9' or count(../nem:eSituation/nem:eSituation.12[text() = 'I46.9']) != 0))">Cardiac Arrest Indicator should not be No when Primary or Secondary Impression indicate arrest.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eArrest.18 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.18" />
			<sch:assert id="Rule_884" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.18) or nem:eArrest.18 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">"End of EMS Cardiac Arrest Event" is required on all arrests.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_899" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and (nem:eArrest.14 and nem:eArrest.14 != ''))">Cardiac Arrest Indicator cannot be No when Date/Time of Arrest is Given</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_900" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and nem:eArrest.18 = ('3018001', '3018003', '3018011', '3018005', '3018009', '3018007'))">Cardiac arrest indicator cannot be NO when arrest event outcome is given.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_901" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and (nem:eArrest.11 and nem:eArrest.11 != ''))">Cardiac arrest indicator cannot be NO when 1st Arrest Rhythm is given</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_902" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001001' and (count(nem:eArrest.03[text() = ('3003001', '3003003', '3003005', '3003007', '3003009')]) != 0))">Cardiac arrest indicator cannot be NO when Resuscitation Attempt by Provider indicates arrest.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_905" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 != '3001003' and nem:eArrest.07 = '3007005')">If "AED Use Prior to EMS Arrival is equal to Yes, with Defibrillation then "Cardiac Arrest" must be Yes, Prior to EMS Arrival</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eProcedures.13 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
			<sch:let name="nemsisElements" value="nem:eProcedures.13" />
			<sch:assert id="Rule_924" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eProcedures.03 = ('405442007', '405427009', '405430002', '42550007', '392230005', '233526002', '430824005') and (not(nem:eProcedures.13) or nem:eProcedures.13 = '') and (not(nem:eProcedures.03[@PN]) or (not(nem:eProcedures.03[@PN=('8801001', '8801003', '8801019')]))) and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-10-01T00:00:00'))">Vascular Access Location is required when a vascular access is documented.
</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.32 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.32"/>
				<sch:assert id="Rule_925" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[((nem:eVitals.32 and nem:eVitals.32 != ''))]) &lt; 1 and count(../nem:eVitals.VitalGroup[((nem:eVitals.32[@PN]))]) &lt; 1) and (../../nem:eSituation/nem:eSituation.11 = ('P08.21', 'P07.3', 'P22') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('P08.21', 'P07.3', 'P22')]) != 0)))">At least one APGAR is required when Primary or Secondary Impressions indicate newborn. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.22 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.22"/>
				<sch:assert id="Rule_930" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.21 = '4221005' and (not(nem:eDisposition.22) or nem:eDisposition.22 = ''))">Hospital In-Patient Destination required if taken to non-ER</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.08"/>
				<sch:assert id="Rule_934" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eInjury.08[text() = ('2908007', '2908009')]) != 0) and (count(nem:eInjury.08[text() = ('2908001', '2908005', '2908003')]) != 0))">Airbag Deployment has conflicting values. Cannot select No Airbag Deployed or No Airbag Present when selecting other value.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.10 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.10"/>
				<sch:assert id="Rule_937" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eResponse.10[text() = '2210017']) != 0 and (count(nem:eResponse.10[text() = ('2210001', '2210003', '2210005', '2210007', '2210009', '2210011', '2210013', '2210015', '2210039', '2210019', '2210021', '2210023', '2210025', '2210027', '2210029', '2210031', '2210033', '2210035', '2210037')]) != 0))">When Non/No Delay is Selected No Other Delay can be included </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.07"/>
				<sch:assert id="Rule_941" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eProcedures.07[text() = '3907033']) != 0 and (count(nem:eProcedures.07[text() = ('3907001', '3907003', '3907047', '3907007', '3907005', '3907009', '3907011', '3907013', '3907015', '3907017', '3907019', '3907021', '3907023', '3907025', '3907027', '3907031', '3907035', '3907039', '3907041', '3907043', '3907045', '3907049', '3907051')]) != 0))">Procedure Complication cannot have None along with another value</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.07"/>
				<sch:assert id="Rule_942" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.06 and nem:eVitals.06 != '') and nem:eVitals.07 != '' and nem:eVitals.06 != '' and number(nem:eVitals.07) &gt; number(nem:eVitals.06))">DBP (Diastolic Blood Pressure) (eVitals.07) cannot be greater than SBP. Enter valid DBP.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.12"/>
				<sch:assert id="Rule_944" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[((nem:eVitals.12 and nem:eVitals.12 != ''))]) &lt; 1 and count(../nem:eVitals.VitalGroup[((nem:eVitals.12[@PN]))]) &lt; 1) and (../../nem:eSituation/nem:eSituation.08 = ('2808003', '2808019') or ../../nem:eSituation/nem:eSituation.09 = ('R09.2', 'R07.1', 'R06.3', 'R06.02', 'R07.9', 'R07.89', 'R41.82', 'R06.81', 'R57.0', 'R06.00', 'R00.2', 'R06.1', 'R06.2', 'R06.4') or (count(../../nem:eSituation/nem:eSituation.10[text() = ('R09.2', 'R07.1', 'R07.89', 'R07.9', 'R06.81', 'R57.0', 'R06.00', 'R06.4', 'R00.2', 'R06.3', 'R06.02', 'R06.1', 'R55', 'R06.2', 'R41.82')]) != 0) or ../../nem:eSituation/nem:eSituation.11 = ('R41.82', 'J05.1', 'I49.9', 'I31.4', 'I63.9', 'I50.9', 'I21.4', 'I62.9', 'R07.89', 'I21.2', 'I20.0', 'S27.0', 'S27.1', 'G45.9', 'R55', 'I21.1', 'I21.0', 'B97.4', 'J98.9', 'P22', 'J80', 'T17.9', 'J68.9', 'B97.21', 'J81.0', 'I26', 'J44.1', 'T70.3', 'I20.9', 'J20.9', 'J98.01', 'J05.0', 'T78.2', 'T71.9', 'K22.2') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('I49.9', 'I31.4', 'I21.4', 'I21.0', 'I21.1', 'I21.2', 'J98.9', 'P22', 'B97.4', 'J80', 'T17.9', 'J68.9', 'R41.82', 'I20.9', 'J05.1', 'J98.01', 'J20.9', 'J81.0', 'J05.0', 'T78.2', 'T70.3', 'K22.2', 'I50.9', 'J11', 'I62.9', 'I26', 'R07.89', 'J93.9', 'R55', 'B97.21', 'G45.9', 'S27.1', 'S27.0')]) != 0)))">At least one Pulse Oximetry required on all patients with possible cardiac, respiratory or altered mental status problems. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eVitals.30 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup">
			<sch:let name="nemsisElements" value="nem:eVitals.30" />
			<sch:assert id="Rule_945" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.29 and nem:eVitals.29 != '') and (not(nem:eVitals.29[@PN])) and (not(nem:eVitals.30) or nem:eVitals.30 = '') and ../../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-05-01T00:00:00'))">Stroke Scale Type (eVitals.30) required when documenting stroke score. Document stroke scale type.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.08"/>
				<sch:assert id="Rule_951" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eMedications.08[text() = '3708031']) != 0 and (count(nem:eMedications.08[text() = ('3708001', '3708003', '3708005', '3708007', '3708009', '3708011', '3708015', '3708017', '3708019', '3708021', '3708013', '3708023', '3708025', '3708043', '3708029', '3708033', '3708035', '3708037', '3708039', '3708045', '3708041')]) != 0))">Medication Complication has conflicting values. Field cannot contain None and another value.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_965" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[((nem:eVitals.32 and nem:eVitals.32 != ''))]) &lt; 1 and count(nem:eVitals.VitalGroup[((nem:eVitals.32[@PN]))]) &lt; 1) and (../nem:eSituation/nem:eSituation.11 = ('P08.21', 'P07.3', 'P22') or (count(../nem:eSituation/nem:eSituation.12[text() = ('P08.21', 'P07.3', 'P22')]) != 0)))">At least one APGAR is required when Primary or Secondary Impressions indicate newborn. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_966" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[((nem:eVitals.12 and nem:eVitals.12 != ''))]) &lt; 1 and count(nem:eVitals.VitalGroup[((nem:eVitals.12[@PN]))]) &lt; 1) and (../nem:eSituation/nem:eSituation.08 = ('2808003', '2808019') or ../nem:eSituation/nem:eSituation.09 = ('R09.2', 'R07.1', 'R06.3', 'R06.02', 'R07.9', 'R07.89', 'R41.82', 'R06.81', 'R57.0', 'R06.00', 'R00.2', 'R06.1', 'R06.2', 'R06.4') or (count(../nem:eSituation/nem:eSituation.10[text() = ('R09.2', 'R07.1', 'R07.89', 'R07.9', 'R06.81', 'R57.0', 'R06.00', 'R06.4', 'R00.2', 'R06.3', 'R06.02', 'R06.1', 'R55', 'R06.2', 'R41.82')]) != 0) or ../nem:eSituation/nem:eSituation.11 = ('R41.82', 'J05.1', 'I49.9', 'I31.4', 'I63.9', 'I50.9', 'I21.4', 'I62.9', 'R07.89', 'I21.2', 'I20.0', 'S27.0', 'S27.1', 'G45.9', 'R55', 'I21.1', 'I21.0', 'B97.4', 'J98.9', 'P22', 'J80', 'T17.9', 'J68.9', 'B97.21', 'J81.0', 'I26', 'J44.1', 'T70.3', 'I20.9', 'J20.9', 'J98.01', 'J05.0', 'T78.2', 'T71.9', 'K22.2') or (count(../nem:eSituation/nem:eSituation.12[text() = ('I49.9', 'I31.4', 'I21.4', 'I21.0', 'I21.1', 'I21.2', 'J98.9', 'P22', 'B97.4', 'J80', 'T17.9', 'J68.9', 'R41.82', 'I20.9', 'J05.1', 'J98.01', 'J20.9', 'J81.0', 'J05.0', 'T78.2', 'T70.3', 'K22.2', 'I50.9', 'J11', 'I62.9', 'I26', 'R07.89', 'J93.9', 'R55', 'B97.21', 'G45.9', 'S27.1', 'S27.0')]) != 0)))">At least one Pulse Oximetry required on all patients with possible cardiac, respiratory or altered mental status problems. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.05"/>
				<sch:assert id="Rule_969" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eHistory.05[text() = '3105005']) != 0 and (count(nem:eHistory.05[text() = ('3105001', '3105003', '3105007')]) + ../count(nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.05'][nem:eCustomResults.01 = ('it3105.102')][nem:eCustomResults.03 = ../../nem:eHistory/nem:eHistory.05/@CorrelationID]) != 0))">Advanced Directive has conflicting values. Cannot have None and other values.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.18"/>
				<sch:assert id="Rule_974" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.13 != '9906001' and (nem:eHistory.18 and nem:eHistory.18 != '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Pregnancy" should only be completed if female. Select Not Applicable or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.18" />
				<sch:assert id="Rule_5982" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.25 != '9919001' and (nem:eHistory.18 and nem:eHistory.18 != '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Pregnancy" should only be completed if female. Select Not Applicable or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup/nem:eExam.AbdomenGroup">
				<sch:let name="nemsisElements" value="nem:eExam.11"/>
				<sch:assert id="Rule_975" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../../nem:ePatient/nem:ePatient.13 != '9906001' and count(nem:eExam.11[text() = '3511043']) != 0 and ../../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Abdomen Assessment"  indicates pregnant when patient not female. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
				<sch:let name="nemsisElements" value="nem:eExam.12"/>
				<sch:assert id="Rule_976" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:ePatient/nem:ePatient.13 != '9906001' and count(nem:eExam.12[text() = '3512049']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Pelivis/Genitourinary Assessment" indicates pregnant-crowning when not female. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
				<sch:let name="nemsisElements" value="nem:eExam.12"/>
				<sch:assert id="Rule_978" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:ePatient/nem:ePatient.13 != '9906001' and count(nem:eExam.12[text() = '3512013']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Pelivis/Genitourinary Assessment" indicates bleeding-vaginal when not female. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.24 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.24"/>
				<sch:assert id="Rule_979" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.24 = '4224007' and ../../nem:ePatient/nem:ePatient.13 != '9906001' and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Destination Team Pre-Arrival Alert or Activation" indicates Yes-Obstetrics when patient not female. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.11"/>
				<sch:assert id="Rule_980" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.13 != '9906001' and nem:eSituation.11 = ('O75','O60.1','O60.0','O73.0','O80','O71.9','O72','O72.1','O03','O21.9','O14.9','O62.0','N93.9') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Primary Impression" indicates pregnancy on non-female patient. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.12"/>
				<sch:assert id="Rule_981" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.13 != '9906001' and (count(nem:eSituation.12[text() = ('O75','O60.1','O60.0','O14.9','O21.9','O03','O73.0','O72','O72.1','O62.0','O80','O71.9','N93.9')]) != 0) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Secondary Impression"  indicates pregnancy on non-female patient. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_982" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1) and (../nem:eSituation/nem:eSituation.11 = ('P08.21','P07.3') or (count(../nem:eSituation/nem:eSituation.12[text() = ('P08.21','P07.3')]) != 0)))">At least one Blood Glucose Level is required on pre- or post-term newborns or in distress. Enter a value or select a Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.18"/>
				<sch:assert id="Rule_983" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@NV])]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1) and (../../nem:eSituation/nem:eSituation.11 = ('P08.21','P07.3') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('P08.21','P07.3')]) != 0)))">At least one Blood Glucose Level (eVitals.18) is required on pre- or post-term newborns or in distress. Enter a value or select a Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.09"/>
				<sch:assert id="Rule_984" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eSituation.09 = ('N93.9','N92.6','O47') and ../nem:ePatient/nem:ePatient.13 != '9906001' and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Primary Symptom" indicates Vaginal Bleeding or Menstruation when non-female patient. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_985" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24 and nem:eVitals.24 != ''))]) &lt; 1 and count(nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24[@PN]))]) &lt; 1) and (../nem:eSituation/nem:eSituation.09 = ('R50.9', 'R56.0', 'R65.21') or (count(../nem:eSituation/nem:eSituation.10[text() = ('R50.9', 'R56.0', 'R65.21')]) != 0) or ../nem:eSituation/nem:eSituation.11 = ('R50.9', 'A41.9', 'R65.21') or (count(../nem:eSituation/nem:eSituation.12[text() = ('R50.9', 'A41.9')]) != 0)))">At least one Temperature is required with sepsis or if febrile. Enter a value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.10 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.10"/>
				<sch:assert id="Rule_986" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.13 != '9906001' and (count(nem:eSituation.10[text() = ('N93.9','N92.6','O47')]) != 0) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">Secondary Symptom indicates Vaginal Bleeding or Menstruation when non-female patient. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.24 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.24"/>
				<sch:assert id="Rule_987" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../../nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24 and nem:eVitals.24 != ''))]) &lt; 1 and count(../../nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24[@PN]))]) &lt; 1) and (../../../nem:eSituation/nem:eSituation.09 = ('R50.9', 'R56.0', 'R65.21') or (count(../../../nem:eSituation/nem:eSituation.10[text() = ('R50.9', 'R56.0', 'R65.21')]) != 0) or ../../../nem:eSituation/nem:eSituation.11 = ('R50.9', 'A41.9', 'R65.21') or (count(../../../nem:eSituation/nem:eSituation.12[text() = ('R50.9', 'A41.9')]) != 0)))">At least one Temperature is required with sepsis or if febrile. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eAirway.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eAirway/nem:eAirway.AirwayGroup/nem:eAirway.ConfirmationGroup">
				<sch:let name="nemsisElements" value="nem:eAirway.03"/>
				<sch:assert id="Rule_990" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(../nem:eAirway.ConfirmationGroup) != 0 and (not(nem:eAirway.03) or nem:eAirway.03 = ''))">"Airway Device Being Confirmed" is required when Airway Confirmed</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.05"/>
				<sch:assert id="Rule_991" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eArrest/nem:eArrest.03[text() = '3003009']) != 0) and ((not(nem:eHistory.05) or nem:eHistory.05 = '') or count(nem:eHistory.05[text() = '3105005']) != 0 or nem:eHistory.05[@NV = '7701001']))">"Advance Directives" must not be blank, None, or Not Applicable when no resuscitation due to DNR. Enter value.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.27 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.27"/>
				<sch:assert id="Rule_3566" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.27) or nem:eDisposition.27 = ''))">Unit Disposition is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.28 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.28"/>
				<sch:assert id="Rule_3567" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.28) or nem:eDisposition.28 = '') and nem:eDisposition.27 = '4227001')">Patient Evaluation/Care cannot be blank if Patient Contact is Made.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.29 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.29"/>
				<sch:assert id="Rule_3568" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.27 = '4227001' and (not(nem:eDisposition.29) or nem:eDisposition.29 = ''))">Crew Disposition cannot be blank if Patient Contact was made.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.30 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.30"/>
				<sch:assert id="Rule_3569" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.30) or nem:eDisposition.30 = '') and nem:eDisposition.27 = '4227001')">Transport Disposition cannot be blank if Patient Contact was made. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eDisposition.32 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition">
			<sch:let name="nemsisElements" value="nem:eDisposition.32" />
			<sch:assert id="Rule_3570" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.32) or nem:eDisposition.32 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228005', '4228003', '4228007', '4228009') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Level of Care Provided per Protocol is required when Patient Evaluated and Care is Provided. </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.31 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.31"/>
				<sch:assert id="Rule_3571" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.31) or nem:eDisposition.31 = '') and nem:eDisposition.30 = ('4230009', '4230013'))">Reason for Refusal/Release is required when Patient Refused Transport or No Transport.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
				<sch:let name="nemsisElements" value="nem:eCrew.03"/>
				<sch:assert id="Rule_3573" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 != '') and (not(nem:eCrew.03) or nem:eCrew.03 = ''))">Crew Member Response Role is Not Documented. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.03"/>
				<sch:assert id="Rule_3574" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.03) or nem:eDisposition.03 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Destination Street Address is required on all transports. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.04"/>
				<sch:assert id="Rule_3575" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.04) or nem:eDisposition.04 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Destination City is required on all transports.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.06"/>
				<sch:assert id="Rule_3576" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.06) or nem:eDisposition.06 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Destination County is required on all transports. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.07"/>
				<sch:assert id="Rule_3577" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.07) or nem:eDisposition.07 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and nem:eDisposition.07[@NV != '7701001'])">Destination Zip Code is required on all transports. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.01"/>
				<sch:assert id="Rule_3578" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eDisposition.01) or nem:eDisposition.01 = ''))">Destination Name is required on all transports</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.05"/>
				<sch:assert id="Rule_3579" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.05) or nem:eDisposition.05 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Destination State is required on all transports. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.02"/>
				<sch:assert id="Rule_3580" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.02) or nem:eDisposition.02 = '') and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Destination/Transported To Code is required on all transports.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eNarrative.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eNarrative">
				<sch:let name="nemsisElements" value="nem:eNarrative.01"/>
				<sch:assert id="Rule_3581" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eNarrative.01) or nem:eNarrative.01 = ''))">Patient Care Report Narrative Not Completed</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.15"/>
				<sch:assert id="Rule_3582" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.15) or nem:eScene.15 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011'))">Incident Street Address Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.17"/>
				<sch:assert id="Rule_3583" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.17) or nem:eScene.17 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011'))">Incident City Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.18"/>
				<sch:assert id="Rule_3584" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.18) or nem:eScene.18 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011'))">Incident State Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.21 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.21"/>
				<sch:assert id="Rule_3585" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.21) or nem:eScene.21 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011'))">Incident County Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.19 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.19"/>
				<sch:assert id="Rule_3586" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.19) or nem:eScene.19 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011'))">Incident Zip Code Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.14 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.14" />
			<sch:assert id="Rule_3587" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.14) or nem:eTimes.14 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227003','4227005'))">Unit Cancelled Date/Time is required on cancellations</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.13"/>
				<sch:assert id="Rule_3588" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eDisposition.13) or nem:eDisposition.13 = '' or count(nem:eDisposition.13[text() = ('9909001', '9909003', '9909007', '9909005', '9909009', '9909011', '9909013', '9909015')]) = 0))">How Patient Was Moved to the Ambulance was Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.14 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.14"/>
				<sch:assert id="Rule_3589" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eDisposition.14) or nem:eDisposition.14 = '' or count(nem:eDisposition.14[text() = ('4214001', '4214003', '4214005', '4214007', '4214009', '4214011', '4214013', '4214015', '4214017', '4214019')]) = 0))">Position of Patient During Transport Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.20 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.20"/>
				<sch:assert id="Rule_3590" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.20) or nem:eDisposition.20 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Reason for Choosing Destination Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.01"/>
				<sch:assert id="Rule_3591" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eHistory.01) or nem:eHistory.01 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001')">Barriers to Patient Care Not Documented. This is required on any patient contact. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.01"/>
				<sch:assert id="Rule_3592" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27) or ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '' or (not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227005')))) and (not(nem:eScene.01) or nem:eScene.01 = '') and (not(nem:eScene.01[@NV])))">First EMS Unit on Scene Not Documented. Select Yes or No, or select Not Applicable.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.06"/>
				<sch:assert id="Rule_3593" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eScene.06) or nem:eScene.06 = '') and (not(nem:eScene.06[@NV=('7701001')])) and (not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27) or ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '' or (not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227005', '4227007', '4227009', '4227011')))))">Document the Number of Patients at Scene or Select Not Applicable.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eSituation.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.11" />
			<sch:assert id="Rule_3594" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.11) or nem:eSituation.11 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Provider's Primary Impression Not Documented</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.12" />
			<sch:assert id="Rule_3595" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.12) or nem:eSituation.12 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eSituation.12[@NV]) or nem:eSituation.12[@NV != '7701001']) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Provider's Secondary Impression Not Documented</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.09 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.09" />
			<sch:assert id="Rule_3596" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003') and (not(nem:eTimes.09) or nem:eTimes.09 = ''))">Document the Unit Left Scene Date/Time </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.11" />
			<sch:assert id="Rule_3597" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003') and (not(nem:eTimes.11) or nem:eTimes.11 = ''))">Document Pt. Arrived At Destination Date/Time </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eTimes.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.12" />
			<sch:assert id="Rule_3598" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eTimes.12) or nem:eTimes.12 = '') and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205009', '2205003', '2205005') or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eResponse.05'][nem:eCustomResults.01 = ('it2205.138')])">Document Destination Patient Transfer of Care Date/Time is required on all patient transports</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.02"/>
				<sch:assert id="Rule_3599" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.02) or nem:eSituation.02 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001')">Possible Injury Not Documented.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eHistory.901 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.901" />
			<sch:assert id="Rule_3600" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'])  or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][not(nem:eCustomResults.01[@PN])]) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Recent Travel is required on all patients. You must enter an answer or a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.07 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.07" />
			<sch:assert id="Rule_3601" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.07) or nem:eTimes.07 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001')">Arrived at Patient Date/Time is required on all patient contacts.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eDisposition.19 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition">
			<sch:let name="nemsisElements" value="nem:eDisposition.19" />
			<sch:assert id="Rule_3602" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.19) or nem:eDisposition.19 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003', '4230005', '4230007', '4230009', '4230013') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Final Patient Acuity is required when patient is evaluated</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.13"/>
				<sch:assert id="Rule_3603" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.13) or nem:eSituation.13 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003', '4230005', '4230007'))">Initial Patient Acuity is required with transport disposition.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3604" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.06 and nem:eVitals.06 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.06[@PN]))]) &lt; 1)">Systolic Blood Pressure must be documented at least once with patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3605" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.06 and nem:eVitals.06 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.06[@PN]))]) &lt; 1)">Systolic Blood Pressure must be documented at least once with patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3606" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.07 and nem:eVitals.07 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.07[@PN]))]) &lt; 1 and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[(nem:eVitals.08 = '3308009')]) &lt; 1)">Diastolic Blood Pressure must be documented at least once with patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3607" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.07 and nem:eVitals.07 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[((nem:eVitals.07[@PN]))]) &lt; 1 and count(nem:eVitals.VitalGroup/nem:eVitals.BloodPressureGroup[(nem:eVitals.08 = '3308009')]) &lt; 1)">Diastolic Blood Pressure must be documented at least once with patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3608" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.HeartRateGroup[((nem:eVitals.10 and nem:eVitals.10 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.HeartRateGroup[((nem:eVitals.10[@PN]))]) &lt; 1)">Heart Rate required at least once with Patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3609" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup/nem:eVitals.HeartRateGroup[((nem:eVitals.10 and nem:eVitals.10 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup/nem:eVitals.HeartRateGroup[((nem:eVitals.10[@PN]))]) &lt; 1)">Heart Rate required at least once with Patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3610" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup[((nem:eVitals.14 and nem:eVitals.14 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup[((nem:eVitals.14[@PN]))]) &lt; 1)">Respiratory Rate must be documented with value or a Pertinent Negative. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3611" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eVitals.VitalGroup[((nem:eVitals.14 and nem:eVitals.14 != ''))]) &lt; 1 and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and count(nem:eVitals.VitalGroup[((nem:eVitals.14[@PN]))]) &lt; 1)">Respiratory Rate must be documented with value or a Pertinent Negative. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eTimes.08 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.08" />
			<sch:assert id="Rule_3612" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.08) or nem:eTimes.08 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.29 = ('4229003'))">When care is transferred to another EMS unit, Document Transfer of Patient Care Date/Time to other EMS Provider</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.01"/>
				<sch:assert id="Rule_3613" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.01) or nem:eArrest.01 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001')">Cardiac Arrest is required on all patients. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.PatientNameGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.02"/>
				<sch:assert id="Rule_3614" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.02) or nem:ePatient.02 = '') and (not(nem:ePatient.02[@PN])))">Patient Last Name cannot be blank. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.PatientNameGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.03"/>
				<sch:assert id="Rule_3615" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.03) or nem:ePatient.03 = '') and (not(nem:ePatient.03[@PN])))">Patient First Name cannot be blank. Enter value or select pertinent negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.17"/>
				<sch:assert id="Rule_3616" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.17) or nem:ePatient.17 = '') and (not(nem:ePatient.17[@PN])))">Patient's DOB required on all patients OR select Refused or Unable to Complete.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.16 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.AgeGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.16"/>
				<sch:assert id="Rule_3617" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.16) or nem:ePatient.16 = ''))">Age units are required for all patients.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.16 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.AgeGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.16"/>
				<sch:assert id="Rule_3618" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(((not(../nem:ePatient.17) or ../nem:ePatient.17 = '') and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001') and ((not(nem:ePatient.15) or nem:ePatient.15 = '') or (not(nem:ePatient.16) or nem:ePatient.16 = '')))">Either Age and Age Units or DOB are required on all patients - Enter the date of birth or best approximation for AGE and AGE UNITS.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.13"/>
				<sch:assert id="Rule_3619" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.13) or nem:ePatient.13 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">Gender is required on all patients. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eDisposition.27 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
			<sch:let name="nemsisElements" value="nem:eDisposition.27" />
			<sch:assert id="Rule_3620" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.27 != '4227001' and (../../nem:eTimes/nem:eTimes.07 and ../../nem:eTimes/nem:eTimes.07 != ''))">Unit Disposition Should indicate Arrived at Patient Date/Time</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.01"/>
				<sch:assert id="Rule_3636" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eHistory.01[text() = '3101009']) != 0 and count(nem:eHistory.01[text() = ('3101001', '3101003', '3101005', '3101007', '3101011', '3101013', '3101015', '3101017', '3101019', '3101021', '3101023', '3101025', '3101027', '3101029', '3101031', '3101033', '3101035')]) != 0)">Barriers to Patient Care Cannot have "None Noted" and another Value chosen at the same time</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.01"/>
				<sch:assert id="Rule_3637" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eVitals.01 != '' and ../../nem:eTimes/nem:eTimes.12 != '' and xs:dateTime(nem:eVitals.01) &gt; xs:dateTime(../../nem:eTimes/nem:eTimes.12))">"Date-Time Vital Signs Taken" must occur before "Destination patient transfer of care"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eHistory.902 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.902" />
			<sch:assert id="Rule_3640" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '9922005'] and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905'][nem:eCustomResults.01 = '']) and count(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = (eHistory.RecentCityTravelGroup)]) = 0 and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">When Travel (eHistory.901) is Yes, you must answer either eHistory.902 Recent Local Travel OR eHistory.904 Recent International Travel OR eHistory.905 Recent State Travel OR eHistory.906 Recent City Travel. You must enter an answer or Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.01"/>
				<sch:assert id="Rule_3641" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eVitals.01 != '' and ../../nem:eTimes/nem:eTimes.07 != '' and xs:dateTime(nem:eVitals.01) &lt; xs:dateTime(../../nem:eTimes/nem:eTimes.07) and nem:eVitals.02 = '9923001')">Date-Time Vital Signs Taken must be after At Patient Time  when taken by this unit</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.07"/>
				<sch:assert id="Rule_3644" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001003' and (not(nem:eArrest.07) or nem:eArrest.07 = ''))">When Cardiac Arrest Indicator is "Yes, Prior to EMS arrival". AED Used Prior to EMS Arrival should not be blank.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.25 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.25"/>
				<sch:assert id="Rule_3645" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((nem:eDisposition.25 and nem:eDisposition.25 != '')) and (nem:eDisposition.24 = '4224001' or nem:eDisposition.24[@NV = '7701001']))">Date/Time of Destination Prearrival Alert or Activation should be blank if No alert or Activation was done.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.11"/>
				<sch:assert id="Rule_3646" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001005' and (not(nem:eArrest.11) or nem:eArrest.11 = ''))">"First Monitored Arrest Rhythm" is required when arrest indicator equal Yes, After EMS Arrival.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eArrest.14 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.14" />
			<sch:assert id="Rule_3647" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.14) or nem:eArrest.14 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Date/Time of Cardiac Arrest is required on all arrests.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.03"/>
				<sch:assert id="Rule_3648" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eArrest.03[text() = ('3003005', '3003001')]) != 0) and (count(nem:eArrest.03[text() = ('3003007', '3003009', '3003011')]) != 0))">When "Resuscitation Attempted by EMS" includes CPR or defibrillation, cannot have values that indicate Not Attempted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
				<sch:let name="nemsisElements" value="nem:eCrew.02"/>
				<sch:assert id="Rule_3649" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eCrew.02) or nem:eCrew.02 = ''))">"Crew Member Level" is required</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.01"/>
				<sch:assert id="Rule_3650" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eSituation/nem:eSituation.02 = '9922005' and (not(nem:eInjury.01) or nem:eInjury.01 = ''))">"Cause of Injury" is required on all patients with possible injury.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.02"/>
				<sch:assert id="Rule_3651" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eSituation/nem:eSituation.02 = '9922005' and (not(nem:eInjury.02) or nem:eInjury.02 = ''))">"Mechanism of Injury" is required on all patients with possible injury.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.25 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.25"/>
				<sch:assert id="Rule_3652" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.25 != '' and ../../nem:eTimes/nem:eTimes.11 != '' and xs:dateTime(nem:eDisposition.25) &gt; xs:dateTime(../../nem:eTimes/nem:eTimes.11))">Date/Time of Destination Prearrival Alert or Activation cannot be after arrival at destination.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.12"/>
				<sch:assert id="Rule_3653" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(count(nem:eArrest.12[text() = '3012001']) != 0 and (count(nem:eArrest.12[text() = ('3012003', '3012005', '3012007')]) != 0))">"Any Return of Spontaneous Circulation" has Conflicting Values </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itArrest.009 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:itArrest.009"/>
				<sch:assert id="Rule_3654" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eArrest.12[text() = '3012005']) != 0 and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.009']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.009'][nem:eCustomResults.01 = '']))">ROSC Time is Required if ROSC Present Prior to Arrival at ED </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.24 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.24"/>
				<sch:assert id="Rule_3657" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../../nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24 and nem:eVitals.24 != ''))]) = 0 and count(../../nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24[@PN]))]) = 0) and (count(../../../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'fever'))]) &gt; 0 or count(../../../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'febrile'))]) &gt; 0 or count(../../../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'sepsis'))]) &gt; 0))">At least one "Temperature" should be recorded when the "Complaint" contains fever, febrile or sepsis. Record temperature in Celsius or record pertinent negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3658" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24 and nem:eVitals.24 != ''))]) = 0 and count(nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup[((nem:eVitals.24[@PN]))]) = 0) and (count(../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'fever'))]) &gt; 0 or count(../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'febrile'))]) &gt; 0 or count(../nem:eSituation/nem:eSituation.PatientComplaintGroup[(contains(nem:eSituation.04, 'sepsis'))]) &gt; 0))">At least one "Temperature" should be recorded when the "Complaint" contains fever, febrile or sepsis. Record temperature in Celsius or record pertinent negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.25 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.TemperatureGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.25"/>
				<sch:assert id="Rule_3659" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.24 and nem:eVitals.24 != '') and (not(nem:eVitals.25) or nem:eVitals.25 = '') and ../nem:eVitals.02 = '9923001')">"Temperature Method" is required when recording temperature </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDispatch.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDispatch">
				<sch:let name="nemsisElements" value="nem:eDispatch.01"/>
				<sch:assert id="Rule_3660" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDispatch.01) or nem:eDispatch.01 = ''))">Complaint Reported by Dispatch is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.03"/>
				<sch:assert id="Rule_3661" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001005' and (not(nem:eArrest.03) or nem:eArrest.03 = ''))">Resuscitation Attempted by EMS is required on all arrests</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.08"/>
				<sch:assert id="Rule_3662" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eResponse.08[text() = '2208013']) != 0 and (count(nem:eResponse.08[text() = ('2208001', '2208003', '2208005', '2208007', '2208009', '2208011', '2208015', '2208017', '2208019', '2208021', '2208023')]) != 0))">When None/No Delay is Selected No Other Type of Dispatch Delay can be Selected</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.08"/>
				<sch:assert id="Rule_3663" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.03 and nem:eProcedures.03 != '') and not(nem:eProcedures.03[@PN=('8801001', '8801003', '8801019', '8801023', '8801027')]) and nem:eProcedures.08[@NV = '7701001'] and nem:eProcedures.02 = '9923001')">Response to Procedure  required when procedure is performed by this unit.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.01"/>
				<sch:assert id="Rule_3666" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.01) or nem:eMedications.01 = '') and nem:eMedications.02 = '9923001')">Date/Time Medication Administered is required when medication is entered. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.02"/>
				<sch:assert id="Rule_3667" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.02) or nem:eMedications.02 = ''))">Document if Medication Administered Prior to this Units EMS Care</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.10 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.10"/>
				<sch:assert id="Rule_3668" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.10) or nem:eMedications.10 = ''))">Role/Type of Person Administering Medication Not Documented</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.17"/>
				<sch:assert id="Rule_3669" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.17) or nem:eDisposition.17 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Transport From Scene is required with all transports</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.21 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.21"/>
				<sch:assert id="Rule_3670" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.21) or nem:eDisposition.21 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Type of Destination is Required on Transports by this unit</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.11"/>
				<sch:assert id="Rule_3672" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.11) or nem:eDisposition.11 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Number of Patients Transported by This EMS Unit  is required on transports by this unit</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.16 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.16"/>
				<sch:assert id="Rule_3673" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.16) or nem:eDisposition.16 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">EMS Transport Method is required on transports (Not Values not accepted on transports)</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.18"/>
				<sch:assert id="Rule_3674" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.18) or nem:eDisposition.18 = '') and nem:eDisposition.17 = ('4217003', '4217007') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Additional Transport Mode Indicators is required on transports</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
				<sch:let name="nemsisElements" value="nem:eExam.03"/>
				<sch:assert id="Rule_3731" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((not(nem:eExam.03) or nem:eExam.03 = '')) and ((nem:eExam.04 and nem:eExam.04 != '') or (nem:eExam.05 and nem:eExam.05 != '') or (nem:eExam.06 and nem:eExam.06 != '') or (nem:eExam.07 and nem:eExam.07 != '') or (nem:eExam.09 and nem:eExam.09 != '') or (nem:eExam.12 and nem:eExam.12 != '') or (nem:eExam.19 and nem:eExam.19 != '') or (nem:eExam.20 and nem:eExam.20 != '') or count(nem:eExam.AbdomenGroup) != 0 or count(nem:eExam.SpineGroup) != 0 or count(nem:eExam.ExtremityGroup) != 0 or count(nem:eExam.EyeGroup) != 0 or count(nem:eExam.ChestGroup) != 0 or count(nem:eExam.LungGroup) != 0))">Enter Assessment Date/Time</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.13"/>
				<sch:assert id="Rule_3732" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eArrest/nem:eArrest.01 = ('3001005','3001003') and (not(nem:ePatient.13) or nem:ePatient.13 = '' or (not(nem:ePatient.13 = ('9906003','9906001','9906007','9906009','9906005','9906011')))) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">For cardiac arrests, the patient's gender must be documented.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.04"/>
				<sch:assert id="Rule_3733" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.04) or nem:eMedications.04 = '') and nem:eMedications.02 = '9923001')">Medication Route  is required when giving meds</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.09"/>
				<sch:assert id="Rule_3734" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eMedications.02 = '9923001' and (nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.09) or nem:eMedications.09 = '') and nem:eMedications.09[@NV != '7701001'])">Medication Crew Member ID  is required when giving meds</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eOther.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eOther">
				<sch:let name="nemsisElements" value="nem:eOther.08"/>
				<sch:assert id="Rule_3735" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eOther.08) or nem:eOther.08 = ''))">Crew Member Completing this Report is required. Not Values are not accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.07"/>
				<sch:assert id="Rule_3736" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eInjury.07[text() = '2907015']) != 0 and (count(nem:eInjury.07[text() = ('2907001', '2907003', '2907005', '2907007', '2907009', '2907029', '2907017', '2907019', '2907021', '2907023', '2907027', '2907031', 'OccupantSafetyEquipmentUseType_UnabletoDetermine')]) != 0))">Use of Protective Devices has conflicting values. Can't have "None" when listing other values.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.09"/>
				<sch:assert id="Rule_3737" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227001', '4227003', '4227007', '4227009', '4227011') and (not(nem:eScene.09) or nem:eScene.09 = ''))">Incident Location Type is required if not Cancelled Prior to Arrival at Scene. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.14 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.14"/>
				<sch:assert id="Rule_3738" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.14) or nem:ePatient.14 = ''))">Race is required on all patient contacts. Select all that apply.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.06"/>
				<sch:assert id="Rule_3739" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eHistory.06) or nem:eHistory.06 = '') and (not(nem:eHistory.06[@PN])))">Medication Allergies is required with patient contact. Enter a value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.06"/>
				<sch:assert id="Rule_3740" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and count(nem:eHistory.06) = 0)">Medication Allergies is required with patient contact (grid)</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.08"/>
				<sch:assert id="Rule_3741" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eHistory.08) or nem:eHistory.08 = '') and (not(nem:eHistory.08[@PN])))">Medical/Surgical History is required with patient contact. Enter a value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.17"/>
				<sch:assert id="Rule_3744" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eHistory.17) or nem:eHistory.17 = '') and (not(nem:eHistory.17[@PN])))">Alcohol/Drug Use Indicators (eHistory.17) is required on all patients. Select value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.09"/>
				<sch:assert id="Rule_3745" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eSituation.09) or nem:eSituation.09 = ''))">Primary Symptom is required with patient contact </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.03"/>
				<sch:assert id="Rule_3746" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.01 and nem:eMedications.01 != '') and (not(nem:eMedications.03) or nem:eMedications.03 = ''))">Medication Given (eMedications.03) is required when entering a medication.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup/nem:eMedications.DosageGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.05"/>
				<sch:assert id="Rule_3747" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eMedications.03 and ../nem:eMedications.03 != '') and ../nem:eMedications.02 = '9923001' and (not(nem:eMedications.05) or nem:eMedications.05 = '') and (not(../nem:eMedications.03[@PN])))">Medication Dosage is required when entering a medication.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.06 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup/nem:eMedications.DosageGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.06"/>
				<sch:assert id="Rule_3748" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eMedications.03 and ../nem:eMedications.03 != '') and (not(../nem:eMedications.03[@PN])) and (not(nem:eMedications.06) or nem:eMedications.06 = '') and ../nem:eMedications.02 = '9923001')">Medication Dosage Units (eMedications.06) is required when entering a medication</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.07"/>
				<sch:assert id="Rule_3749" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.03[@PN])) and nem:eMedications.02 = '9923001' and (not(nem:eMedications.07) or nem:eMedications.07 = ''))">Response to Medication is required when entering a medication</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eMedications.08 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eMedications/nem:eMedications.MedicationGroup">
				<sch:let name="nemsisElements" value="nem:eMedications.08"/>
				<sch:assert id="Rule_3750" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eMedications.03 and nem:eMedications.03 != '') and (not(nem:eMedications.03[@PN])) and nem:eMedications.02 = '9923001' and (not(nem:eMedications.08) or nem:eMedications.08 = ''))">Medication Complication  when entering a medication</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.26 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.26"/>
				<sch:assert id="Rule_3751" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and count(../nem:eVitals.VitalGroup[((nem:eVitals.26 and nem:eVitals.26 != ''))]) &lt; 1)">Level of Responsiveness (AVPU) required at least once with patient contact</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3752" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and count(nem:eVitals.VitalGroup[((nem:eVitals.26 and nem:eVitals.26 != ''))]) &lt; 1)">Level of Responsiveness (AVPU) required at least once with patient contact</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.PatientComplaintGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.PatientComplaintGroup"/>
				<sch:assert id="Rule_3754" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and count(nem:eSituation.PatientComplaintGroup) = 0)">"Patient Complaint" Grid must be documented if there is a patient contact.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eInjury.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eInjury">
				<sch:let name="nemsisElements" value="nem:eInjury.04"/>
				<sch:assert id="Rule_3755" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.13 = ('9906003','9906005','9906009') and count(nem:eInjury.04[text() = '2904021']) != 0 and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">Trauma Triage Criteria (Steps 3 and 4) include Pregnancy on Male or Unknown</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eInjury.03 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eInjury">
			<sch:let name="nemsisElements" value="nem:eInjury.03" />
			<sch:assert id="Rule_3756" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eSituation/nem:eSituation.02 = '9922005' and (not(nem:eInjury.03) or nem:eInjury.03 = '') and (not(nem:eInjury.03[@NV])) and (not(nem:eInjury.03[@PN])))">Trauma Triage Criteria (High Risk for Serious Injury) is required on possible injuries. Enter a value or select Not Applicable or None Reported.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eInjury.04 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eInjury">
			<sch:let name="nemsisElements" value="nem:eInjury.04" />
			<sch:assert id="Rule_3757" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eSituation/nem:eSituation.02 = '9922005' and (not(nem:eInjury.04) or nem:eInjury.04 = '') and (not(nem:eInjury.04[@NV])) and (not(nem:eInjury.04[@PN])))">Trauma Triage Criteria (Moderate Risk for Serious Injury) is required on all patients with possible injury. Enter a value or select Not Applicable or None Reported. </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam">
				<sch:let name="nemsisElements" value="nem:eExam.01"/>
				<sch:assert id="Rule_3758" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((not(nem:eExam.01) or nem:eExam.01 = '') and (not(nem:eExam.01[@PN])) and (not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27) or ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '' or (not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = ('4227003', '4227005', '4227007', '4227009', '4227011'))))) and ((../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.16 = ('2516001', '2516003', '2516005')) or ((../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.15 != '' and ../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.15 &lt; 9) and ../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.16 = '2516009') or ((../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.15 != '' and ../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.15 &lt; 97) and ../nem:ePatient/nem:ePatient.AgeGroup/nem:ePatient.16 = '2516007')))">Body Weight Needed When 8 years or less. Enter weight or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eCrew.02 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
			<sch:let name="nemsisElements" value="nem:eCrew.02" />
			<sch:assert id="Rule_3782" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((../../nem:eResponse/nem:eResponse.07 = '2207011' and ../../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001','2205003','2205009') and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003')) and (count(../nem:eCrew.CrewGroup[nem:eCrew.02 = ('9925007','9925033')]) &lt; 1 or count(../nem:eCrew.CrewGroup[nem:eCrew.02 = ('9925043','9925037','9925039','9925027')]) &lt; 1))">Air Transports from the Scene require at least two personnel, one of whom must be a paramedic or CCP and the other an RN or NP or PA or MD
</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eCrew.CrewGroup related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew">
			<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup" />
			<sch:assert id="Rule_3784" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((../nem:eResponse/nem:eResponse.07 = '2207011' and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001','2205003','2205009') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003')) and (count(nem:eCrew.CrewGroup[nem:eCrew.02 = ('9925007','9925033')]) &lt; 1 or count(nem:eCrew.CrewGroup[nem:eCrew.02 = ('9925043','9925037','9925027','9925039')]) &lt; 1))">Air Transports from the Scene require at least two personnel, one of whom must be a paramedic or CCP, and the other an RN or NP or PA or MD</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
				<sch:let name="nemsisElements" value="nem:eCrew.02"/>
				<sch:assert id="Rule_3785" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((../../nem:eResponse/nem:eResponse.07 = '2207011' and ../../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = '2205005' and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003')) and (count(../nem:eCrew.CrewGroup) &lt; 2 or count(../nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925043', '9925037', '9925039', '9925027'))]) &lt; 1))">Interfacility Air Transports require at least two personnel, one of whom must be a RN or NP or PA or MD
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.CrewGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew">
				<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup"/>
				<sch:assert id="Rule_3786" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((../nem:eResponse/nem:eResponse.07 = '2207011' and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = '2205005' and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003')) and (count(nem:eCrew.CrewGroup) &lt; 2 or count(nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925043', '9925037', '9925027', '9925039'))]) &lt; 1))">Interfacility Air Transports require at least two personnel, one of whom must be a RN or NP or PA or MD
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eCrew.02 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
			<sch:let name="nemsisElements" value="nem:eCrew.02" />
			<sch:assert id="Rule_3787" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../../nem:eResponse/nem:eResponse.07 = ('2207015','2207017','2207019') and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003') and count(../nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925005','9925002','9925001','9925007','9925003','9925043','9925037','9925027','9925039','9925029','9925033') or ../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eCrew.02'][nem:eCustomResults.01 = ('it9925.101')])]) &lt; 2)">Ground Ambulance Transports Require a minimum of 2 medics (eCrew.02).</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eCrew.CrewGroup related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew">
			<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup" />
			<sch:assert id="Rule_3788" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(count(nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925005','9925002','9925001','9925007','9925003','9925043','9925037','9925027','9925039','9925029','9925033') or ../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eCrew.02'][nem:eCustomResults.01 = ('it9925.101')])]) &lt; 2 and ../nem:eResponse/nem:eResponse.07 = ('2207015','2207017','2207019') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001','4230003'))">Ground Ambulance Transports Require a minimum of 2 medics.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
				<sch:let name="nemsisElements" value="nem:eCrew.02"/>
				<sch:assert id="Rule_3789" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../../nem:eResponse/nem:eResponse.07 = ('2207015', '2207017', '2207019') and count(../nem:eCrew.CrewGroup[(nem:eCrew.02 = '9925003' and count(nem:eCrew.03[text() = '2403013']) != 0)]) &gt; 0 and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">Ground Ambulance Transports may NOT have an EMT-R as the primary patient caregiver during transport </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.CrewGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew">
				<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup"/>
				<sch:assert id="Rule_3790" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eResponse/nem:eResponse.07 = ('2207015', '2207017', '2207019') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and count(nem:eCrew.CrewGroup[(nem:eCrew.02 = '9925003' and count(nem:eCrew.03[text() = '2403013']) != 0)]) &gt; 0)">Ground Ambulance Transports may NOT have an EMT-R as the primary patient caregiver during transport</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eCrew.02 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
			<sch:let name="nemsisElements" value="nem:eCrew.02" />
			<sch:assert id="Rule_3791" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../../nem:eResponse/nem:eResponse.07 = ('2207015','2207017','2207019') and count(../nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925005','9925002','9925001','9925007','9925043','9925037','9925027','9925039','9925033') or ../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eCrew.02'][nem:eCustomResults.01 = ('it9925.101')])]) = 0 and count(../nem:eCrew.CrewGroup[nem:eCrew.02 = '9925003']) &gt; 1)">Ground Ambulance Responses may not have both crew members at the EMT-R level </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eCrew.CrewGroup related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eCrew">
			<sch:let name="nemsisElements" value="nem:eCrew.CrewGroup" />
			<sch:assert id="Rule_3792" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eResponse/nem:eResponse.07 = ('2207015','2207017','2207019') and count(nem:eCrew.CrewGroup[(nem:eCrew.02 = ('9925005','9925002','9925001','9925007','9925043','9925037','9925027','9925039','9925033') or ../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eCrew.02'][nem:eCustomResults.01 = ('it9925.101')])]) = 0 and count(nem:eCrew.CrewGroup[nem:eCrew.02 = '9925003']) &gt; 1)">Ground Ambulance Responses may not have both crew members at the EMT-R level  </sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.20 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.20"/>
				<sch:assert id="Rule_3793" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eResponse.20) or nem:eResponse.20 = '') and nem:eResponse.07 = ('2207019', '2207015', '2207017'))">On-Scene Odometer Reading is required on all calls with Patient Transport.
	</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.21 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.21"/>
				<sch:assert id="Rule_3794" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and (not(nem:eResponse.21) or nem:eResponse.21 = '') and nem:eResponse.07 = ('2207019', '2207015', '2207017'))">Patient Destination Odometer Reading is required on all calls with Patient Transports.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.15"/>
				<sch:assert id="Rule_3796" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((not(nem:eScene.15) or nem:eScene.15 = '') or (nem:eScene.15[@NV])))">The "Incident Street Address" field must be documented on all cardiac arrests. Not Values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.17"/>
				<sch:assert id="Rule_3797" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((not(nem:eScene.17) or nem:eScene.17 = '') or (nem:eScene.17[@NV])))">The "Incident City" field must be documented on cardiac arrests. Not Values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.18"/>
				<sch:assert id="Rule_3798" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((not(nem:eScene.18) or nem:eScene.18 = '') or (nem:eScene.18[@NV])))">The "Incident State" field must be documented on all cardiac arrests. Not Values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eScene.19 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eScene">
				<sch:let name="nemsisElements" value="nem:eScene.19"/>
				<sch:assert id="Rule_3799" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((not(nem:eScene.19) or nem:eScene.19 = '') or (nem:eScene.19[@NV])))">The "Incident Zip Code" field must be documented on cardiac arrests. Not Values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.PatientNameGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.02"/>
				<sch:assert id="Rule_3800" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003') and (not(nem:ePatient.02[@PN]))) and ((not(nem:ePatient.02) or nem:ePatient.02 = '') or (nem:ePatient.02[@NV])))">The "Last Name" field must be documented. Not values will NOT be accepted. Do NOT enter a generic/fake/unknown name. Use the Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.PatientNameGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.03"/>
				<sch:assert id="Rule_3801" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003') and (not(nem:ePatient.03[@PN]))) and ((not(nem:ePatient.03) or nem:ePatient.03 = '') or (nem:ePatient.03[@NV])))">The "First Name" field must be documented on all cardiac arrests. Not values will not be accepted. Do not enter a generic/fake/unknown name here - if you do not know the patient's name, enter a Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.AgeGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.15"/>
				<sch:assert id="Rule_3802" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((../../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((((not(../nem:ePatient.17) or ../nem:ePatient.17 = '') and (not(../nem:ePatient.17[@PN=('8801019', '8801023')]))) and ((not(nem:ePatient.15) or nem:ePatient.15 = '') or (not(nem:ePatient.16) or nem:ePatient.16 = ''))) or ((nem:ePatient.15[@NV]) and (../nem:ePatient.17[@NV]) and (nem:ePatient.16[@NV]))))">Either the "Date of Birth" or both the "Age" and "Age Units" fields must be documented on all cardiac arrests. Not values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.13 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.13"/>
				<sch:assert id="Rule_3803" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005','3001003') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00')) and ((not(nem:ePatient.13) or nem:ePatient.13 = '') or (nem:ePatient.13[@NV])))">The "Gender" field must be documented on all cardiac arrests. Not Values will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.14 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.14"/>
				<sch:assert id="Rule_3806" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003')) and ((nem:ePatient.14[@NV=('7701001')]) or ((not(nem:ePatient.14) or nem:ePatient.14 = '') and (not(nem:ePatient.14[@NV])))))">The "Race" field must be documented on all cardiac arrests. Not Applicable will not be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eRecord.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eRecord">
				<sch:let name="nemsisElements" value="nem:eRecord.01"/>
				<sch:assert id="Rule_3807" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eRecord.01) or nem:eRecord.01 = '') and ../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003'))">The "Patient Care Report Number" field must be documented on all cardiac arrests.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.03"/>
				<sch:assert id="Rule_3808" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.01 = ('3001005', '3001003')) and (((count(nem:eArrest.03[text() = ('3003001', '3003003', '3003005')]) != 0) and (count(nem:eArrest.03[text() = ('3003007', '3003009')]) != 0)) or ((count(nem:eArrest.03[text() = ('3003001', '3003005')]) != 0) and (count(nem:eArrest.03[text() = ('3003011')]) != 0))))">When "Resuscitation Attempted by EMS" includes CPR or defibrillation, cannot have values that indicate Not Attempted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.12"/>
				<sch:assert id="Rule_3809" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003') and nem:eSituation.11 != 'I46.9' and count(nem:eSituation.12[text() = 'I46.9']) = 0)">When indicating Yes to Cardiac Arrest, then the Primary or Secondary Impression must include CV-Cardiac Arrest (ICD-10 code I46.9).</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itArrest.011 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:itArrest.011"/>
				<sch:assert id="Rule_3810" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.011']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.011'][nem:eCustomResults.01 = '']) and nem:eArrest.02 = '3002011')">The "Cardiac Arrest Etiology - Other" field must be documented if the "Cardiac Arrest Etiology" field is equal to "Other"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.04"/>
				<sch:assert id="Rule_3811" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = '3001005' and count(nem:eArrest.04[text() = '3004001']) != 0)">The "Arrest Witnessed By" field cannot be equal to "Not Witnessed" when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival." </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.04"/>
				<sch:assert id="Rule_3812" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(count(nem:eArrest.04[text() = '3004001']) != 0 and count(nem:eArrest.04[text() = ('3004003', '3004005', '3004007')]) != 0)">The "Arrest Witnessed By" field cannot have "Not Witnessed" as well as one of the "Witnessed" choices.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.22 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.22"/>
				<sch:assert id="Rule_3813" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.11 = ('3011009', '3011011', '3011013')) and ((not(nem:eArrest.22) or nem:eArrest.22 = '') or (nem:eArrest.22[@NV])))">When the "First Monitored Arrest Rhythm" field is listed as a shockable rhythm, then the "Who First Defibrillated the Patient" must be documented. Not Values will NOT be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.22 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.22"/>
				<sch:assert id="Rule_3814" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.07 = '3007005') and (nem:eArrest.22 = '3022013' or (nem:eArrest.22[@NV])))">The "Who First Defibrillated the Patient" field should not be "Not Applicable" or "Responding EMS Personnel" when the "AED Use Prior to EMS Arrival" field is equal to "Yes, with Defibrillation"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itArrest.012 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:itArrest.012"/>
				<sch:assert id="Rule_3815" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.012'][nem:eCustomResults.01 = 'itArrest.012.101'] and nem:eArrest.18 = '3018003')">The "Sustained ROSC (20 Consecutive Minutes)" field should not be "Yes, pulse at end of EMS Care (or ED Arrival)" when "End of EMS Cardiac Arrest Event" field is "Expired in the Field"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itArrest.014 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:itArrest.014"/>
				<sch:assert id="Rule_3816" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.014']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itArrest.014'][nem:eCustomResults.01 = '']) and nem:eArrest.01 = ('3001005', '3001003'))">Resuscitation Attempted by 911 Responder must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.20 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.20"/>
				<sch:assert id="Rule_3817" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.20) or nem:eArrest.20 = '') and nem:eArrest.01 = ('3001005', '3001003') and nem:eArrest.20[@NV != '7701001'])">The "Who First Initiated CPR" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.07"/>
				<sch:assert id="Rule_3818" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.01 = ('3001005', '3001003')) and ((not(nem:eArrest.07) or nem:eArrest.07 = '') or (nem:eArrest.07[@NV])))">The "AED Use Prior to EMS Arrival" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival". Not Values will NOT be accepted.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.21 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.21"/>
				<sch:assert id="Rule_3819" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.21) or nem:eArrest.21 = '') and nem:eArrest.01 = ('3001005', '3001003') and nem:eArrest.07 = ('3007003', '3007005') and nem:eArrest.21[@NV != '7701001'])">The "Who First Applied the AED" field must be documented when the "AED Use Prior to EMS Arrival" field is one of "Yes, Applied without Defibrillation" or "Yes, With Defibrillation"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.11 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.11"/>
				<sch:assert id="Rule_3820" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.11) or nem:eArrest.11 = '') and nem:eArrest.11[@NV != '7701001'] and nem:eArrest.01 = ('3001005', '3001003'))">The "First Monitored Arrest Rhythm of the Patient" is required if the patient was in cardiac arrest before or after arrival of EMS. If the patient had a pulse when EMS arrives, choose "Not Applicable".</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.22 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.22"/>
				<sch:assert id="Rule_3821" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.22) or nem:eArrest.22 = '') and nem:eArrest.01 = ('3001005', '3001003') and nem:eArrest.22[@NV != '7701001'])">The "Who First Defibrillated the Patient" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yest, Prior to EMS Arrival"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.04 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.04"/>
				<sch:assert id="Rule_3822" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.04) or nem:eArrest.04 = '') and nem:eArrest.01 = ('3001005', '3001003'))">The "Arrest Witnessed By" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival"</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eArrest.14 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.14" />
			<sch:assert id="Rule_3823" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.01 = ('3001005', '3001003') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00')) and ((not(nem:eArrest.14) or nem:eArrest.14 = '') or (nem:eArrest.14 = '' and nem:eArrest.14[@NV])))">The "Date/Time of Cardiac Arrest" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival". Not values will not be accepted. If the date/time is not known, it should be estimated.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eTimes.13 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.13" />
			<sch:assert id="Rule_3825" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.13 != '' and nem:eTimes.03 != '' and (abs(days-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 86400) + (abs(hours-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 3600) + (abs(minutes-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 60) + (abs(seconds-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03)))) &gt; 129600 and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 != '2205007')">"Unit Back in Service" is more than 36 hours after "Unit Notified by Dispatch"</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eTimes.13 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.13" />
			<sch:assert id="Rule_3826" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eTimes.13 != '' and nem:eTimes.03 != '' and (abs(days-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 86400) + (abs(hours-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 3600) + (abs(minutes-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03))) * 60) + (abs(seconds-from-duration(xs:dateTime(nem:eTimes.13) - xs:dateTime(nem:eTimes.03)))) &gt; 86400 and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 != '2205007')">Unit Back in Service should not be more than 24 hours after Unit Notified by Dispatch.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eResponse.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eResponse">
				<sch:let name="nemsisElements" value="nem:eResponse.07"/>
				<sch:assert id="Rule_3829" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not((not(nem:eResponse.07) or nem:eResponse.07 = ''))">Unit Transport and Equipment Capability is a mandatory field.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eArrest.01 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.01" />
			<sch:assert id="Rule_3830" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.20) or nem:eArrest.20 = '') and (not(nem:eArrest.20[@NV]) or nem:eArrest.20[@NV != '7701001']))">Who First Initiated CPR is required when Cardiac Arrest is equal to Yes. Select Not Applicable if CPR was not initiated. 

</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itArrest.108 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:itArrest.108"/>
				<sch:assert id="Rule_3831" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.07 = ('3007003', '3007005') and (not(nem:eArrest.21) or nem:eArrest.21 = ''))">Who First Applied the AED is required if AED used prior to EMS arrival (with or without defibrillation)</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.09"/>
				<sch:assert id="Rule_3832" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.03 and nem:eProcedures.03 != '') and nem:eProcedures.02 = '9923001' and (not(nem:eProcedures.09) or nem:eProcedures.09 = '') and nem:eProcedures.10 = ('9905005', '9905001', '9905007', '9905002') or ../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eProcedures.10'][nem:eCustomResults.01 = ('it9905.192')])">Procedure Crew Member ID is required when performing procedure by this unit.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eSituation.18 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.18" />
			<sch:assert id="Rule_3833" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(((not(nem:eSituation.18) or nem:eSituation.18 = '') and (not(../nem:eDisposition/nem:eDisposition.21) or ../nem:eDisposition/nem:eDisposition.21 = '' or (not(../nem:eDisposition/nem:eDisposition.21 = ('4221019','4221001','4221007','4221009','4221025','4221037','4221033','4221041','4221029','4221031','4221039','4221027','4221035','4221013')) and not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')]))) and (not(nem:eSituation.18[@PN]))) and (nem:eSituation.11 = ('G45.9','G81.90','I63.9','I46.9','T75.1','R09.2','R09.89','J96.00','R41.82','I62.9','H53.9') or (count(nem:eSituation.12[text() = ('G45.9','I63.9','G81.90','I46.9','T75.1','R09.2','J96.00','R09.89','R41.82','I62.9','H53.9')]) != 0)))">Date/Time Last Known Well NOT documented</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
		<!---->
		<sch:pattern>
			<sch:title>ePayment.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePayment">
				<sch:let name="nemsisElements" value="nem:ePayment.01"/>
				<sch:assert id="Rule_3835" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((nem:ePayment.50 and nem:ePayment.50 != '') and (not(nem:ePayment.01) or nem:ePayment.01 = ''))">Primary Method of Payment (ePayment.01) is required when CMS Service Level is entered</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePayment.50 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePayment">
				<sch:let name="nemsisElements" value="nem:ePayment.50"/>
				<sch:assert id="Rule_3836" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((nem:ePayment.01 and nem:ePayment.01 != '') and (not(nem:ePayment.50) or nem:ePayment.50 = '') and (not(nem:ePayment.50[@NV])))">CMS Service Level Not Documented when primary method of payment is selected. Select value or choose Not Applicable.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eProcedures.07 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
				<sch:let name="nemsisElements" value="nem:eProcedures.07"/>
				<sch:assert id="Rule_3837" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.03 and nem:eProcedures.03 != '') and (not(nem:eProcedures.03[@PN=('8801001', '8801003', '8801019', '8801023')])) and (not(nem:eProcedures.07) or nem:eProcedures.07 = '') and nem:eProcedures.02 = '9923001')">Procedure Complication (eProcedures.07) is required when performed by this unit</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eProcedures.06 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
			<sch:let name="nemsisElements" value="nem:eProcedures.06" />
			<sch:assert id="Rule_3838" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eProcedures.03 and nem:eProcedures.03 != '') and (not(nem:eProcedures.06) or nem:eProcedures.06 = '') and nem:eProcedures.02 = '9923001' and (not(nem:eProcedures.03[@PN]) or (not(nem:eProcedures.03[@PN=('8801001', '8801003', '8801019')]))) and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-10-01T00:00:00'))">Procedure Successful (eProcedures.06) is required when procedure performed</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.18"/>
				<sch:assert id="Rule_3839" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@NV])]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1 and (not(../../nem:eDisposition/nem:eDisposition.21) or ../../nem:eDisposition/nem:eDisposition.21 = '' or (not(../../nem:eDisposition/nem:eDisposition.21 = ('4221007','4221025','4221009','4221013','4221019','4221001','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (../../nem:eSituation/nem:eSituation.11 = ('I63.9','R41.82','I62.9','G40.901','G40.909','G45.9','R55','G81.90') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('R41.82','I62.9','G40.909','G40.901','G45.9','R55','G81.90','I63.9')]) != 0)))">At least one Blood Glucose Level is required on all possible stroke patients. Enter a value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3840" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and (not(../nem:eDisposition/nem:eDisposition.21) or ../nem:eDisposition/nem:eDisposition.21 = '' or (not(../nem:eDisposition/nem:eDisposition.21 = ('4221007','4221025','4221009','4221013','4221019','4221001','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (../nem:eSituation/nem:eSituation.11 = ('I63.9','R41.82','I62.9','G40.901','G40.909','G45.9','R55','G81.90') or (count(../nem:eSituation/nem:eSituation.12[text() = ('R41.82','I62.9','G40.909','G40.901','G45.9','G81.90','R55','I63.9')]) != 0)))">At least one Blood Glucose Level is required on all possible stroke patients. Enter value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.18"/>
				<sch:assert id="Rule_3841" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@NV])]) &lt; 1 and count(../nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1 and (not(../../nem:eDisposition/nem:eDisposition.21) or ../../nem:eDisposition/nem:eDisposition.21 = '' or (not(../../nem:eDisposition/nem:eDisposition.21 = ('4221007','4221025','4221009','4221013','4221019','4221001','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (../../nem:eSituation/nem:eSituation.11 = ('E87.5','E16.2','E13.65','E13.64','E27.40','E86.1') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('E87.5','E13.65','E86.1','E13.64','E16.2','E27.40')]) != 0)))">At least Blood Glucose Level is required with possible endocrine problems. Enter a  value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3842" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18[@PN])]) &lt; 1 and count(nem:eVitals.VitalGroup[(nem:eVitals.18 and nem:eVitals.18 != '')]) &lt; 1 and (not(../nem:eDisposition/nem:eDisposition.21) or ../nem:eDisposition/nem:eDisposition.21 = '' or (not(../nem:eDisposition/nem:eDisposition.21 = ('4221007','4221025','4221009','4221013','4221019','4221001','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (../nem:eSituation/nem:eSituation.11 = ('E87.5','E16.2','E13.65','E13.64','E27.40','E86.1') or (count(../nem:eSituation/nem:eSituation.12[text() = ('E87.5','E13.65','E86.1','E13.64','E16.2','E27.40')]) != 0)))">At least 1 Blood Glucose Level is required with possible endocrine problems. Enter a  value or select Pertinent Negative.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.31 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.31"/>
				<sch:assert id="Rule_3843" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../nem:eVitals.VitalGroup[((nem:eVitals.31 and nem:eVitals.31 != ''))]) &lt; 1 and count(../nem:eVitals.VitalGroup[((nem:eVitals.31 and nem:eVitals.31 != ''))]) &lt; 1 and (not(../../nem:eDisposition/nem:eDisposition.21) or ../../nem:eDisposition/nem:eDisposition.21 = '' or (not(../../nem:eDisposition/nem:eDisposition.21 = ('4221025', '4221009', '4221007', '4221019', '4221001', '4221013', '4221031', '4221039', '4221027', '4221029', '4221033', '4221035', '4221041')) and not(../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (count(../nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup[(nem:eVitals.29 = '3329005')]) &gt; 0 or ../../nem:eSituation/nem:eSituation.11 = ('I63.9', 'I21.4', 'I21.0', 'I21.1', 'I21.2') or (count(../../nem:eSituation/nem:eSituation.12[text() = ('I21.4', 'I21.0', 'I21.1', 'I21.2')]) != 0)))">At least 1 Reperfusion Checklist is required on possible stroke or STEMI patients. Document checklist when Stroke Scale Score equals Positive. Pertinent Negatives are not allowed. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.VitalGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals">
				<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup"/>
				<sch:assert id="Rule_3844" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[((nem:eVitals.31 and nem:eVitals.31 != ''))]) &lt; 1 and count(nem:eVitals.VitalGroup[((nem:eVitals.31 and nem:eVitals.31 != ''))]) &lt; 1 and (not(../nem:eDisposition/nem:eDisposition.21) or ../nem:eDisposition/nem:eDisposition.21 = '' or (not(../nem:eDisposition/nem:eDisposition.21 = ('4221025', '4221009', '4221007', '4221019', '4221001', '4221013', '4221031', '4221039', '4221027', '4221029', '4221033', '4221035', '4221041')) and not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')])))) and (count(nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup[(nem:eVitals.29 = '3329005')]) &gt; 0 or ../nem:eSituation/nem:eSituation.11 = ('I63.9', 'I21.4', 'I21.0', 'I21.1', 'I21.2') or (count(../nem:eSituation/nem:eSituation.12[text() = ('I21.4', 'I21.0', 'I21.1', 'I21.2')]) != 0)))">At least 1 Reperfusion Checklist is required on possible stroke or STEMI patients. Document checklist when Stroke Scale Score equals Positive. 	Pertinent Negatives are not allowed. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eHistory.903 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.903" />
			<sch:assert id="Rule_3846" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903'][not(nem:eCustomResults.01[@PN])]) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Recent Exposure to Infectious Disease is required on all patients. You must enter an answer or a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.18 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.18"/>
				<sch:assert id="Rule_3847" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eSituation.02 = '9922005' and (not(nem:eSituation.18) or nem:eSituation.18 = '') and not(nem:eSituation.18[@PN]))">Date/Time Last Known Well is required when possible injury. For injury or trauma related events, this is the date and time the patient was injured.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.15 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient/nem:ePatient.AgeGroup">
				<sch:let name="nemsisElements" value="nem:ePatient.15"/>
				<sch:assert id="Rule_3848" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(((not(../nem:ePatient.17) or ../nem:ePatient.17 = '') and ../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001') and ((not(nem:ePatient.15) or nem:ePatient.15 = '') or (not(nem:ePatient.16) or nem:ePatient.16 = '')))">Either Age and Age Units or DOB are required on all patients - Enter the date of birth or best approximation for AGE and AGE UNITS.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>ePatient.17 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:ePatient">
				<sch:let name="nemsisElements" value="nem:ePatient.17"/>
				<sch:assert id="Rule_3849" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(((not(nem:ePatient.17) or nem:ePatient.17 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001') and ((not(nem:ePatient.AgeGroup/nem:ePatient.15) or nem:ePatient.AgeGroup/nem:ePatient.15 = '') or (not(nem:ePatient.AgeGroup/nem:ePatient.16) or nem:ePatient.AgeGroup/nem:ePatient.16 = '')))">Either Age and Age Units or DOB are required on all patients - Enter the date of birth or best approximation for AGE and AGE UNITS.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eVitals.03 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.CardiacRhythmGroup">
				<sch:let name="nemsisElements" value="nem:eVitals.03"/>
				<sch:assert id="Rule_3850" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((count(nem:eVitals.03[text() = ('9901003', '9901035', '9901067', '9901071', '9901065', '9901063', '9901001')]) != 0)) and (../../../nem:eArrest/nem:eArrest.01 = '3001001' or ../../../nem:eArrest/nem:eArrest.01[@NV = '7701001']))">Cardiac Arrest Indicator should not be no when an arrest rhythm was present in eVitals.03.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.09 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.09"/>
				<sch:assert id="Rule_3851" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.09) or nem:eArrest.09 = '' or count(nem:eArrest.09[text() = ('3009001', '3009003', '3009005', '3009007', '3009009', '3009011', '3009021')]) = 0) and count(nem:eArrest.03[text() = '3003005']) != 0)">"Resuscitation Attempted by EMS" includes Compressions but "Type of CPR Provided" does not include Compressions</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eHistory.05 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eHistory">
				<sch:let name="nemsisElements" value="nem:eHistory.05"/>
				<sch:assert id="Rule_3852" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((not(nem:eHistory.05) or nem:eHistory.05 = '') and nem:eHistory.05[@NV != '7701001']) and ((../nem:eArrest/nem:eArrest.01 = ('3001005', '3001003') or ../nem:eSituation/nem:eSituation.11 = 'I46.9' or count(../nem:eSituation/nem:eSituation.12[text() = 'I46.9']) != 0) or (../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = '4228005' and count(../nem:eArrest/nem:eArrest.03[text() = '3003007']) = 0)))">Advanced Directive required on all arrests where Disposition indicates No Care Required at Scene. Enter value or select Not Applicable.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.23 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.23"/>
				<sch:assert id="Rule_3853" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.23) or nem:eDisposition.23 = '') and nem:eDisposition.21 = ('4221003', '4221023', '4221005') and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205005', '2205009', '2205003') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003'))">"Hospital Capability" is required on all 911 and interfacility transports. This is the reason that THIS patient was transported to THIS hospital. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.HospitalTeamActivationGroup related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition">
				<sch:let name="nemsisElements" value="nem:eDisposition.HospitalTeamActivationGroup"/>
				<sch:assert id="Rule_3854" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.21 = ('4221003', '4221023', '4221005') and count(nem:eDisposition.HospitalTeamActivationGroup[((nem:eDisposition.24 and nem:eDisposition.24 != ''))]) = 0 and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205005', '2205003', '2205009'))">Destination Team Pre-Arrival Alert or Activation is required on all 911 and interfacility transports to hospitals.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itExam.072 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam">
				<sch:let name="nemsisElements" value="nem:itExam.072"/>
				<sch:assert id="Rule_3856" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.072']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.072'][nem:eCustomResults.01 = '']) and ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '9922005'])">Date patient left to travel is required if Recent Travel is Yes</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>itExam.071 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam">
				<sch:let name="nemsisElements" value="nem:itExam.071"/>
				<sch:assert id="Rule_3857" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(((not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.071']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.071'][nem:eCustomResults.01 = ''])) and ((../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.072'] and ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.072'][nem:eCustomResults.01 != '']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '9922005']))">Date/Time patient returned from travel is required if patient Recent Travel is Yes</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.24 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.24"/>
				<sch:assert id="Rule_3858" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition.21 = ('4221003', '4221023', '4221005') and count(../nem:eDisposition.HospitalTeamActivationGroup[((nem:eDisposition.24 and nem:eDisposition.24 != ''))]) = 0 and ../nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003') and ../../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205005', '2205003', '2205009'))">Destination Team Pre-Arrival Alert or Activation is required on all 911 and interfacility transports to hospitals.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.25 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.25"/>
				<sch:assert id="Rule_3859" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.24 = ('4224003', '4224005', '4224007', '4224009', '4224011', '4224013', '4224015', '4224017', '4224019') and (not(nem:eDisposition.25) or nem:eDisposition.25 = ''))">Date/Time of Destination Prearrival Activation should be documented when a prearrival activation has occurred.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
		<sch:title>eArrest.01 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.01" />
			<sch:assert id="Rule_3865" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eArrest.01) or nem:eArrest.01 = '' or (not(nem:eArrest.01 = ('3001005','3001003')))) and (nem:eArrest.20 and nem:eArrest.20 != '') and (nem:eArrest.20[@NV] and nem:eArrest.20[@NV = '7701001']))">Cardiac Arrest Indicator should be Yes when CPR was initiated.
</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eExam.12 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
				<sch:let name="nemsisElements" value="nem:eExam.12"/>
				<sch:assert id="Rule_3866" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../../nem:ePatient/nem:ePatient.13) or ../../nem:ePatient/nem:ePatient.13 = '' or (not(../../nem:ePatient/nem:ePatient.13 = ('9906003','9906011')))) and count(nem:eExam.12[text() = '3512047']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-11-04T00:00:00'))">"Pelivis/Genitourinary Assessment" indicates penile-priapism when not male. Change value or correct gender.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eVitals.29 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup">
			<sch:let name="nemsisElements" value="nem:eVitals.29" />
			<sch:assert id="Rule_3868" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(../../nem:eVitals.VitalGroup[(nem:eVitals.StrokeScaleGroup/nem:eVitals.29 and nem:eVitals.StrokeScaleGroup/nem:eVitals.29 != '')]) &lt; 1 and count(../../nem:eVitals.VitalGroup[(not(nem:eVitals.StrokeScaleGroup/nem:eVitals.29[@PN]))]) &lt; 1 and (not(../../../nem:eDisposition/nem:eDisposition.21) or ../../../nem:eDisposition/nem:eDisposition.21 = '' or (not(../../../nem:eDisposition/nem:eDisposition.21 = ('4221025','4221009','4221007','4221019','4221001','4221013','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')]))) and ../../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-05-01T00:00:00')) and (../../../nem:eSituation/nem:eSituation.11 = ('I63.9','R41.82','H53.9','R51','G45.9','R53.81','R55','R53.1','G43.9','I62.9','G81.90') or (count(../../../nem:eSituation/nem:eSituation.12[text() = ('R41.82','H53.9','G45.9','R51','R53.1','G43.9','I62.9','I63.9','R53.81','R55','G81.90')]) != 0)))">At least one Stroke Scale Score is required on possible stroke patients. Document Stroke Scale Score OR Select a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eVitals.VitalGroup related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eVitals">
			<sch:let name="nemsisElements" value="nem:eVitals.VitalGroup" />
			<sch:assert id="Rule_3869" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((count(nem:eVitals.VitalGroup[(nem:eVitals.StrokeScaleGroup/nem:eVitals.29 and nem:eVitals.StrokeScaleGroup/nem:eVitals.29 != '')]) &lt; 1 and count(nem:eVitals.VitalGroup[(not(nem:eVitals.StrokeScaleGroup/nem:eVitals.29[@PN]))]) &lt; 1 and (not(../nem:eDisposition/nem:eDisposition.21) or ../nem:eDisposition/nem:eDisposition.21 = '' or (not(../nem:eDisposition/nem:eDisposition.21 = ('4221007','4221025','4221009','4221013','4221019','4221001','4221031','4221039','4221027','4221029','4221033','4221035','4221037','4221041')) and not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eDisposition.21'][nem:eCustomResults.01 = ('it4221.100')]))) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &lt; xs:dateTime('2025-05-01T00:00:00')) and (../nem:eSituation/nem:eSituation.11 = ('I63.9','R41.82','H53.9','R51','G45.9','R53.81','R55','R53.1','G43.9','I62.9','G81.90') or (count(../nem:eSituation/nem:eSituation.12[text() = ('R41.82','H53.9','G45.9','R51','R53.1','G43.9','I62.9','I63.9','R53.81','R55','G81.90')]) != 0)))">At least one Stroke Scale Score is required on possible stroke patients. Document Stroke Scale Score OR Select a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eArrest.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eArrest">
				<sch:let name="nemsisElements" value="nem:eArrest.02"/>
				<sch:assert id="Rule_3870" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.02) or nem:eArrest.02 = '' or (not(nem:eArrest.02 = ('3002001', '3002003', '3002005', '3002007', '3002009', '3002011', '3002013', '3002015')))))">Cardiac Arrest Etiology is Not Documented - the Etiology field must be documented when the Cardiac Arrest field is Yes.</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eDisposition.29 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.IncidentDispositionGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.29"/>
				<sch:assert id="Rule_3879" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.29) or nem:eDisposition.29 = '') and nem:eDisposition.27 = ('4227007', '4227009', '4227011'))">Crew Disposition is required and cannot be left blank. </sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.19 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.19"/>
				<sch:assert id="Rule_3880" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.19) or nem:eSituation.19 = '') and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = '2205031' and not(nem:eSituation.19[@NV]))">Reason for Transfer and/or Visit is required on MIH/Community Paramedicine visits. Enter an explanation or select Not Applicable</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eSituation.20 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eSituation">
				<sch:let name="nemsisElements" value="nem:eSituation.20"/>
				<sch:assert id="Rule_3881" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205005', '2205015', '2205017', '2205019', '2205007') and (not(nem:eSituation.20) or nem:eSituation.20 = '') and not(nem:eSituation.20[@NV]))">Reason for Interfacility Transfer/Medical Transport is required. Enter a value or select Not Applicable</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>ePatient.06 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.06" />
			<sch:assert id="Rule_3882" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.06) or nem:ePatient.06 = '') and (not(nem:ePatient.06[@PN])) and (not(nem:ePatient.22) or nem:ePatient.22 = ''))">Patient's Home City cannot be blank. Enter value or select Unable to Complete.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.07 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.07" />
			<sch:assert id="Rule_3883" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.07) or nem:ePatient.07 = '') and (not(nem:ePatient.07[@NV])) and (not(nem:ePatient.22) or nem:ePatient.22 = ''))">Patient's Home County cannot be blank. Enter a value or select Not Applicable.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.08 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.08" />
			<sch:assert id="Rule_3884" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.08) or nem:ePatient.08 = '') and (not(nem:ePatient.08[@NV])) and (not(nem:ePatient.22) or nem:ePatient.22 = ''))">Patient's Home State cannot be blank. Enter a value or select Not Applicable.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.09 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.09" />
			<sch:assert id="Rule_3885" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.09) or nem:ePatient.09 = '') and (not(nem:ePatient.09[@NV])) and (not(nem:ePatient.22) or nem:ePatient.22 = ''))">Patient's Home Zip Code cannot be blank. Enter a value or select Not Applicable.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eProcedures.02 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eProcedures/nem:eProcedures.ProcedureGroup">
			<sch:let name="nemsisElements" value="nem:eProcedures.02" />
			<sch:assert id="Rule_3886" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:eProcedures.02) or nem:eProcedures.02 = '') and (nem:eProcedures.03 and nem:eProcedures.03 != ''))">Procedure Performed Prior to this Unit's EMS Care is required.

</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
			<sch:pattern>
		<sch:title>eDisposition.32 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition">
			<sch:let name="nemsisElements" value="nem:eDisposition.32" />
			<sch:assert id="Rule_4552" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.32) or nem:eDisposition.32 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228005', '4228003', '4228007') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Level of Care Provided per Protocol is required when Patient Evaluated and Care is Provided. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.11" />
			<sch:assert id="Rule_4555" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.11) or nem:eSituation.11 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Provider's Primary Impression Not Documented</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.12" />
			<sch:assert id="Rule_4556" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.12) or nem:eSituation.12 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001', '4228003', '4228005') and (not(nem:eSituation.12[@NV]) or nem:eSituation.12[@NV != '7701001']) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Provider's Secondary Impression Not Documented</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eDisposition.19 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition">
			<sch:let name="nemsisElements" value="nem:eDisposition.19" />
			<sch:assert id="Rule_4557" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDisposition.19) or nem:eDisposition.19 = '') and nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.30 = ('4230001', '4230003', '4230005', '4230007') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Final Patient Acuity is required when patient is evaluated</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eHistory.901 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.901" />
			<sch:assert id="Rule_4558" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][not(nem:eCustomResults.01[@PN])]) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Recent Travel is required on all patients. You must enter an answer or a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eHistory.902 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.902" />
			<sch:assert id="Rule_4559" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.901'][nem:eCustomResults.01 = '9922005'] and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.902'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.904'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905'][not(nem:eCustomResults.01[@PN])]) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.905'][nem:eCustomResults.01 = '']) and count(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = (eHistory.RecentCityTravelGroup)]) = 0 and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">When Travel (eHistory.901) is Yes, you must answer either eHistory.902 Recent Local Travel OR eHistory.904 Recent International Travel OR eHistory.905 Recent State Travel OR eHistory.906 Recent City Travel. You must enter an answer or Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eHistory.903 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.903" />
			<sch:assert id="Rule_4560" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903'][nem:eCustomResults.01 = '']) and (not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903']) or ../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eHistory.903'][not(nem:eCustomResults.01[@PN])]) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Recent Exposure to Infectious Disease is required on all patients. You must enter an answer or a Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.01 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.01" />
			<sch:assert id="Rule_4564" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eSituation.01) or nem:eSituation.01 = '') and (nem:eSituation.01[@PN] and nem:eSituation.01[@PN = '8801029']) and (nem:eSituation.09 and nem:eSituation.09 != '') and (not(nem:eSituation.09) or nem:eSituation.09 = '' or (not(nem:eSituation.09 = ('Z00.00', 'Z00.129')))))">You must document the approximated Date/Time of Symptom Onset </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eTimes.01 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.01" />
			<sch:assert id="Rule_4568" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205009') and (not(nem:eTimes.01) or nem:eTimes.01 = '') and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">PSAP Call Date/Time is required on 911 responses.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eTimes.02 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eTimes">
			<sch:let name="nemsisElements" value="nem:eTimes.02" />
			<sch:assert id="Rule_4569" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eTimes.02) or nem:eTimes.02 = '') and nem:eTimes.03 != '' and xs:dateTime(nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Dispatch Notified Date/Time is required on ALL responses. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eDispatch.05 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDispatch">
			<sch:let name="nemsisElements" value="nem:eDispatch.05" />
			<sch:assert id="Rule_4570" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eDispatch.05) or nem:eDispatch.05 = '') and ../nem:eResponse/nem:eResponse.ServiceGroup/nem:eResponse.05 = ('2205001', '2205009', '2205005') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Dispatch priority (Patient Acuity) is required on 911 responses and hospital-to-hospital transfers. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eArrest.14 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.14" />
			<sch:assert id="Rule_4583" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eArrest.01 = ('3001005', '3001003') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00')) and ((not(nem:eArrest.14) or nem:eArrest.14 = '') or (nem:eArrest.14[@NV])))">The "Date/Time of Cardiac Arrest" field must be documented when the "Cardiac Arrest" field is equal to "Yes, After EMS Arrival" or "Yes, Prior to EMS Arrival". If the date/time is not known, it should be estimated. Not values will not be accepted.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eArrest.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.12" />
			<sch:assert id="Rule_4584" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.12) or nem:eArrest.12 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = '4228001' and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">Any Return of Spontaneous Circulation is required on all cardiac arrests</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eExam.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup/nem:eExam.AbdomenGroup">
			<sch:let name="nemsisElements" value="nem:eExam.11" />
			<sch:assert id="Rule_5983" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../../nem:ePatient/nem:ePatient.25 != '9919001' and count(nem:eExam.11[text() = '3511043']) != 0 and ../../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Abdomen Assessment"  indicates pregnant when patient not female. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eExam.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
			<sch:let name="nemsisElements" value="nem:eExam.12" />
			<sch:assert id="Rule_5984" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:ePatient/nem:ePatient.25 != '9919001' and count(nem:eExam.12[text() = '3512049']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">Pelvis/Genitourinary Assessment indicates pregnant-crowning when not female. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eExam.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
			<sch:let name="nemsisElements" value="nem:eExam.12" />
			<sch:assert id="Rule_5985" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:ePatient/nem:ePatient.25 != '9919001' and count(nem:eExam.12[text() = '3512013']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">Pelvis/Genitourinary Assessment indicates bleeding-vaginal when not female. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eDisposition.24 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.HospitalTeamActivationGroup">
			<sch:let name="nemsisElements" value="nem:eDisposition.24" />
			<sch:assert id="Rule_5986" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.24 = '4224007' and ../../nem:ePatient/nem:ePatient.25 != '9919001' and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Destination Team Pre-Arrival Alert or Activation" indicates Yes-Obstetrics when patient not female. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.11 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.11" />
			<sch:assert id="Rule_5987" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.25 != '9919001' and nem:eSituation.11 = ('O75','O60.1','O60.0','O73.0','O80','O71.9','O72','O72.1','O03','O21.9','O14.9','O62.0','N93.9') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Primary Impression" indicates pregnancy on non-female patient. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.12" />
			<sch:assert id="Rule_5988" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.25 != '9919001' and (count(nem:eSituation.12[text() = ('O75','O60.1','O60.0','O14.9','O21.9','O03','O73.0','O72','O72.1','O62.0','O80','O71.9','N93.9')]) != 0) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Secondary Impression"  indicates pregnancy on non-female patient. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<sch:pattern>
		<sch:title>eArrest.18 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eArrest">
			<sch:let name="nemsisElements" value="nem:eArrest.18" />
			<sch:assert id="Rule_4585" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eArrest.01 = ('3001005', '3001003') and (not(nem:eArrest.18) or nem:eArrest.18 = '') and ../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = '4228001' and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2024-06-01T00:00:00-06:00'))">"End of EMS Cardiac Arrest Event" is required on all arrests.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>dAgency.04 related rule.</sch:title>
			<sch:rule context="nem:Header/nem:DemographicGroup">
				<sch:let name="nemsisElements" value="nem:dAgency.04"/>
				<sch:assert id="RestrictEMSAgencyState" role="[ERROR]" diagnostics="nemsisDiagnostic" test="not(nem:dAgency.04 != '13')">EMS Agency State must be correct for Georgia (13).</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
		<sch:pattern>
			<sch:title>eCrew.01 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eCrew/nem:eCrew.CrewGroup">
				<sch:let name="nemsisElements" value="nem:eCrew.01"/>
				<sch:assert id="RestrictCrewIDPattern" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(not(matches(nem:eCrew.01, '^[R,E,I,A,C,P][0-9]{6}$')))">Crew Member ID (eCrew.01) must start with a letter (R, E, I, A, C, P) followed by a 6-digit number left padded with 0s (zeroes). For example: R005678, E001234, I023456, A003456, C000012, P015678).</sch:assert>
			</sch:rule>
		</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eSituation.09 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.09" />
			<sch:assert id="Rule_5990" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eSituation.09 = ('N93.9','N92.6','O47') and ../nem:ePatient/nem:ePatient.25 != '9919001' and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Primary Symptom" indicates Vaginal Bleeding or Menstruation when non-female patient. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
		<!---->
	<sch:pattern>
		<sch:title>eSituation.10 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.10" />
			<sch:assert id="Rule_5991" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.25 != '9919001' and (count(nem:eSituation.10[text() = ('N93.9','N92.6','O47')]) != 0) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">Secondary Symptom indicates Vaginal Bleeding or Menstruation when non-female patient. Change value or correct gender.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.25 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.25" />
			<sch:assert id="Rule_5992" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and (not(nem:ePatient.25) or nem:ePatient.25 = '') and (not(nem:ePatient.25[@PN])) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">(DP) Sex is required for all patients. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.25 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.25" />
			<sch:assert id="Rule_5994" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eArrest/nem:eArrest.01 = ('3001005','3001003') and (not(nem:ePatient.25) or nem:ePatient.25 = '' or (not(nem:ePatient.25 = ('9919001','9919003','9919005')))) and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">For cardiac arrests, the patient's sex must be documented.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eInjury.04 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eInjury">
			<sch:let name="nemsisElements" value="nem:eInjury.04" />
			<sch:assert id="Rule_5995" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:ePatient/nem:ePatient.25 = ('9919003','9919005') and count(nem:eInjury.04[text() = '2904021']) != 0 and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">Trauma Triage Criteria (Moderate Risk for Serious Injury) includes Pregnancy on Male or Unknown</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>ePatient.25 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:ePatient">
			<sch:let name="nemsisElements" value="nem:ePatient.25" />
			<sch:assert id="Rule_5996" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((../nem:eArrest/nem:eArrest.01 = ('3001005','3001003') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00')) and ((not(nem:ePatient.25) or nem:ePatient.25 = '') or (nem:ePatient.25[@NV])))">The patient's sex field must be documented on all cardiac arrests. Not Values will not be accepted.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eExam.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eExam/nem:eExam.AssessmentGroup">
			<sch:let name="nemsisElements" value="nem:eExam.12" />
			<sch:assert id="Rule_5997" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(../../nem:ePatient/nem:ePatient.25) or ../../nem:ePatient/nem:ePatient.25 = '' or (not(../../nem:ePatient/nem:ePatient.25 = ('9919003')))) and count(nem:eExam.12[text() = '3512047']) != 0 and ../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-11-04T00:00:00'))">"Pelvis/Genitourinary Assessment" indicates penile-priapism when not male. Change value or correct Sex.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
		<sch:pattern>
			<sch:title>eDisposition.02 related rule.</sch:title>
			<sch:rule context="nem:PatientCareReport/nem:eDisposition/nem:eDisposition.DestinationGroup">
				<sch:let name="nemsisElements" value="nem:eDisposition.02"/>
				<sch:assert id="RestrictByDestinationCode" role="[FATAL]" diagnostics="nemsisDiagnostic" test="not(nem:eDisposition.02 and nem:eDisposition.02 != '' and .[not(nem:eDisposition.02 = ('ALC000005', 'ALC000006', 'ALC000007', 'ALC000008', 'ALC000010', 'ALC000013', 'ALC000016', 'ALC000017', 'ALC000019', 'ALC000020', 'ALC000021', 'ALC000022', 'ALC000023', 'ALC000024', 'ALC000025', 'ALC000026', 'ALC000027', 'ALC000028', 'ALC000029', 'ALC000030', 'ALC000031', 'ALC000032', 'ALC000034', 'ALC000035', 'ALC000036', 'ALC000037', 'ALC000038', 'ALC000039', 'ALC000040', 'ALC000041', 'ALC000042', 'ALC000044', 'ALC000045', 'ALC000046', 'ALC000048', 'ALC000049', 'ALC000050', 'ALC000051', 'ALC000052', 'ALC000054', 'ALC000055', 'ALC000057', 'ALC000058', 'ALC000059', 'ALC000060', 'ALC000061', 'ALC000062', 'ALC000063', 'ALC000072', 'ALC000074', 'ALC000075', 'ALC000083', 'ALC000084', 'ALC000085', 'ALC000086', 'ALC000088', 'ALC000091', 'ALC000093', 'ALC000095', 'ALC000096', 'ALC000097', 'ALC000099', 'ALC000102', 'ALC000104', 'ALC000105', 'ALC000107', 'ALC000116', 'ALC000117', 'ALC000118', 'ALC000120', 'ALC000123', 'ALC000125', 'ALC000128', 'ALC000133', 'ALC000135', 'ALC000138', 'ALC000140', 'ALC000143', 'ALC000146', 'ALC000147', 'ALC000148', 'ALC000149', 'ALC000150', 'ALC000153', 'ALC000154', 'ALC000155', 'ALC000156', 'ALC000157', 'ALC000158', 'ALC000159', 'ALC000160', 'ALC000164', 'ALC000165', 'ALC000167', 'ALC000168', 'ALC000170', 'ALC000171', 'ALC000172', 'ALC000173', 'ALC000174', 'ALC000175', 'ALC000177', 'ALC000178', 'ALC000179', 'ALC000181', 'ALC000182', 'ALC000183', 'ALC000184', 'ALC000185', 'ALC000188', 'ALC000189', 'ALC000190', 'ALC000191', 'ALC000192', 'ALC000194', 'ALC000195', 'ALC000197', 'ALC000198', 'ALC000199', 'ALC000200', 'ALC000201', 'ALC000202', 'ALC000205', 'ALC000206', 'ALC000207', 'ALC000208', 'ALC000210', 'ALC000211', 'ALC000213', 'ALC000245', 'ALC000268', 'ALC000278', 'ALC000549', 'ALC000568', 'ALC000584', 'ALC000588', 'ALC000596', 'ALC000623', 'ALC000651', 'ALC000687', 'ALC000734', 'ALC000220', 'ALC000702', 'ESRD000681', 'ESRD000682', 'ESRD000683', 'ESRD000684', 'ESRD000685', 'ESRD000686', 'ESRD000687', 'ESRD000688', 'ESRD000689', 'ESRD000690', 'ESRD000691', 'ESRD000692', 'ESRD000693', 'ESRD000694', 'ESRD000695', 'ESRD000697', 'ESRD000698', 'ESRD000699', 'ESRD000700', 'ESRD000701', 'ESRD000702', 'ESRD000703', 'ESRD000704', 'ESRD000705', 'ESRD000706', 'ESRD000707', 'ESRD000708', 'ESRD000709', 'ESRD000710', 'ESRD000711', 'ESRD000712', 'ESRD000713', 'ESRD000714', 'ESRD000716', 'ESRD000718', 'ESRD000719', 'ESRD000720', 'ESRD000721', 'ESRD000722', 'ESRD000723', 'ESRD000724', 'ESRD000725', 'ESRD000726', 'ESRD000727', 'ESRD000728', 'ESRD000729', 'ESRD000730', 'ESRD000731', 'ESRD000732', 'ESRD000733', 'ESRD000734', 'ESRD000735', 'ESRD000736', 'ESRD000737', 'ESRD000738', 'ESRD000739', 'ESRD000740', 'ESRD000741', 'ESRD000742', 'ESRD000743', 'ESRD000744', 'ESRD000745', 'ESRD000746', 'ESRD000747', 'ESRD000749', 'ESRD000750', 'ESRD000751', 'ESRD000752', 'ESRD000753', 'ESRD000754', 'ESRD000755', 'ESRD000756', 'ESRD000758', 'ESRD000759', 'ESRD000760', 'ESRD000761', 'ESRD000762', 'ESRD000763', 'ESRD000764', 'ESRD000767', 'ESRD000768', 'ESRD000769', 'ESRD000770', 'ESRD000771', 'ESRD000772', 'ESRD000773', 'ESRD000774', 'ESRD000775', 'ESRD000776', 'ESRD000777', 'ESRD000778', 'ESRD000779', 'ESRD000780', 'ESRD000781', 'ESRD000782', 'ESRD000783', 'ESRD000784', 'ESRD000785', 'ESRD000786', 'ESRD000787', 'ESRD000788', 'ESRD000790', 'ESRD000793', 'ESRD000794', 'ESRD000795', 'ESRD000796', 'ESRD000797', 'ESRD000798', 'ESRD000799', 'ESRD000997', 'ESRD000999', 'ESRD001000', 'ESRD001001', 'ESRD001002', 'ESRD001003', 'ESRD001004', 'ESRD001005', 'ESRD001006', 'ESRD001008', 'ESRD001009', 'ESRD001010', 'ESRD001011', 'ESRD001014', 'ESRD001016', 'ESRD001017', 'ESRD001018', 'ESRD001019', 'ESRD001020', 'ESRD001022', 'ESRD001023', 'ESRD001024', 'ESRD001025', 'ESRD001026', 'ESRD001027', 'ESRD001028', 'ESRD001030', 'ESRD001032', 'ESRD001033', 'ESRD001034', 'ESRD001035', 'ESRD001036', 'ESRD001037', 'ESRD001038', 'ESRD001039', 'ESRD001040', 'ESRD001041', 'ESRD001042', 'ESRD001044', 'ESRD001046', 'ESRD001047', 'ESRD001048', 'ESRD001050', 'ESRD001051', 'ESRD001053', 'ESRD001054', 'ESRD001055', 'ESRD001058', 'ESRD001062', 'ESRD001063', 'ESRD001064', 'ESRD001065', 'ESRD001066', 'ESRD001067', 'ESRD001068', 'ESRD001069', 'ESRD001070', 'ESRD001073', 'ESRD001075', 'ESRD001078', 'ESRD001079', 'ESRD001080', 'ESRD001081', 'ESRD001082', 'ESRD001083', 'ESRD001085', 'ESRD001087', 'ESRD001089', 'ESRD001090', 'ESRD001092', 'ESRD001093', 'ESRD001094', 'ESRD001095', 'ESRD001096', 'ESRD001098', 'ESRD001099', 'ESRD001101', 'ESRD001103', 'ESRD001104', 'ESRD001105', 'ESRD001107', 'ESRD001108', 'ESRD001109', 'ESRD001110', 'ESRD001111', 'ESRD001114', 'ESRD001115', 'ESRD001116', 'ESRD001118', 'ESRD001119', 'ESRD001120', 'ESRD001121', 'ESRD001122', 'ESRD001123', 'ESRD001124', 'ESRD001126', 'ESRD001127', 'ESRD001128', 'ESRD001130', 'ESRD001131', 'ESRD001132', 'ESRD001133', 'ESRD001134', 'ESRD001137', 'ESRD001139', 'ESRD001140', 'ESRD001143', 'ESRD001144', 'ESRD001145', 'ESRD001147', 'ESRD001148', 'ESRD001149', 'ESRD001151', 'ESRD001152', 'ESRD001154', 'ESRD001156', 'ESRD001157', 'ESRD001159', 'ESRD001162', 'ESRD001163', 'ESRD001164', 'ESRD001165', 'ESRD001166', 'ESRD001168', 'ESRD001170', 'ESRD001171', 'ESRD001173', 'ESRD001174', 'ESRD001177', 'ESRD001178', 'ESRD001180', 'ESRD001182', 'ESRD001184', 'ESRD001185', 'ESRD001186', 'ESRD001187', 'ESRD001188', 'ESRD001189', 'ESRD001191', 'ESRD001192', 'ESRD001193', 'ESRD001194', 'ESRD001195', 'ESRD001196', 'ESRD001199', 'ESRD001201', 'ESRD001203', 'ESRD001204', 'ESRD001205', 'ESRD001206', 'ESRD001208', 'ESRD001209', 'ESRD001210', 'ESRD001211', 'ESRD001212', 'ESRD001214', 'ESRD001216', 'ESRD001217', 'ESRD001218', 'ESRD001219', 'ESRD001220', 'ESRD001221', 'ESRD001222', 'ESRD001223', 'ESRD001224', 'ESRD001225', 'ESRD001227', 'ESRD001228', 'ESRD001229', 'ESRD001230', 'ESRD001231', 'ESRD001232', 'ESRD001233', 'ESRD001236', 'ESRD001237', 'ESRD001238', 'ESRD001239', 'ESRD001240', 'ESRD001241', 'ESRD001242', 'ESRD001243', 'ESRD001244', 'ESRD001245', 'ESRD001246', 'ESRD001247', 'ESRD001249', 'ESRD001250', 'ESRD001251', 'ESRD001252', 'ESRD001253', 'ESRD001255', 'ESRD001256', 'ESRD001257', 'ESRD001258', 'ESRD001260', 'ESRD001261', 'ESRD001262', 'ESRD001263', 'ESRD001264', 'ESRD001265', 'ESRD001266', 'ESRD001267', 'ESRD001268', 'ESRD001270', 'ESRD001274', 'ESRD001276', 'ESRD001277', 'ESRD001278', 'ESRD001279', 'ESRD001280', 'ESRD001281', 'ESRD001282', 'ESRD001283', 'ESRD001284', 'ESRD001285', 'ESRD001286', 'ESRD001287', 'ESRD001288', 'ESRD001289', 'ESRD001290', 'ESRD001291', 'ESRD001292', 'ESRD001293', 'ESRD001294', 'ESRD001296', 'ESRD001298', 'ESRD001301', 'ESRD001302', 'ESRD001304', 'ESRD001305', 'ESRD001307', 'ESRD001308', 'ESRD001309', 'ESRD001310', 'ESRD001311', 'ESRD001314', 'ESRD001316', 'ESRD001318', 'ESRD001319', 'ESRD001320', 'ESRD001321', 'ESRD001323', 'ESRD001324', 'ESRD001325', 'ESRD001326', 'ESRD001327', 'ESRD001329', 'ESRD001330', 'ESRD001332', 'ESRD001333', 'ESRD001334', 'ESRD001335', 'ESRD001336', 'ESRD001339', 'ESRD001340', 'ESRD001341', 'ESRD001343', 'ESRD001344', 'ESRD001346', 'ESRD001401', 'ESRD001402', 'ESRD001403', 'ESRD001404', 'ESRD001405', 'ESRD001406', 'ESRD001407', 'ESRD001408', 'ESRD001411', 'ESRD001413', 'ESRD001416', 'ESRD001420', 'ESRD001422', 'ESRD001425', 'ESRD001430', 'ESRD001432', 'ESRD001441', 'ESRD001444', 'ESRD00194', 'ESRD00745', 'ESRD00796', 'HOSPA0002', 'HOSPA0003', 'HOSPA0004', 'HOSPA0005', 'HOSPA0007', 'HOSPA0008', 'HOSPA0009', 'HOSPA0010', 'HOSPA0011', 'HOSPA0012', 'HOSPA0013', 'HOSPA0014', 'HOSPA0015', 'HOSPA0016', 'HOSPA0017', 'HOSPA0019', 'HOSPA0020', 'HOSPA0021', 'HOSPA0022', 'HOSPA0023', 'HOSPA0024', 'HOSPA0025', 'HOSPA0026', 'HOSPA0027', 'HOSPA0028', 'HOSPA0030', 'HOSPA0031', 'HOSPA0032', 'HOSPA0033', 'HOSPA0034', 'HOSPA0035', 'HOSPA0036', 'HOSPA0037', 'HOSPA0038', 'HOSPA0039', 'HOSPA0040', 'HOSPA0041', 'HOSPA0042', 'HOSPA0043', 'HOSPA0044', 'HOSPA0045', 'HOSPA0046', 'HOSPA0049', 'HOSPA0050', 'HOSPA0051', 'HOSPA0052', 'HOSPA0054', 'HOSPA0055', 'HOSPA0056', 'HOSPA0057', 'HOSPA0058', 'HOSPA0059', 'HOSPA0060', 'HOSPA0061', 'HOSPA0062', 'HOSPA0064', 'HOSPA0065', 'HOSPA0066', 'HOSPA0067', 'HOSPA0068', 'HOSPA0069', 'HOSPA0070', 'HOSPA0071', 'HOSPA0072', 'HOSPA0073', 'HOSPA0074', 'HOSPA0075', 'HOSPA0076', 'HOSPA0077', 'HOSPA0078', 'HOSPA0079', 'HOSPA0080', 'HOSPA0081', 'HOSPA0083', 'HOSPA0084', 'HOSPA0085', 'HOSPA0086', 'HOSPA0087', 'HOSPA0088', 'HOSPA0089', 'HOSPA0090', 'HOSPA0091', 'HOSPA0092', 'HOSPA0093', 'HOSPA0094', 'HOSPA0095', 'HOSPA0096', 'HOSPA0098', 'HOSPA0099', 'HOSPA0100', 'HOSPA0101', 'HOSPA0103', 'HOSPA0104', 'HOSPA0105', 'HOSPA0106', 'HOSPA0107', 'HOSPA0108', 'HOSPA0110', 'HOSPA0112', 'HOSPA0114', 'HOSPA0115', 'HOSPA0119', 'HOSPA0120', 'HOSPA0121', 'HOSPA0122', 'HOSPA0123', 'HOSPA0124', 'HOSPA0126', 'HOSPA0127', 'HOSPA0128', 'HOSPA0130', 'HOSPA0132', 'HOSPA0134', 'HOSPA0181', 'HOSPA0184', 'HOSPA0185', 'HOSPA0186', 'HOSPA0187', 'HOSPA0189', 'HOSPA0190', 'HOSPA0191', 'HOSPA0194', 'HOSPA0195', 'HOSPA0197', 'HOSPA0198', 'HOSPA0199', 'HOSPA0200', 'HOSPA0203', 'HOSPC0135', 'HOSPC0137', 'HOSPC0138', 'HOSPC0139', 'HOSPC0141', 'HOSPC0143', 'HOSPC0144', 'HOSPC0145', 'HOSPC0146', 'HOSPC0148', 'HOSPC0180', 'HOSPC0183', 'HOSPL0150', 'HOSPL0152', 'HOSPL0153', 'HOSPL0154', 'HOSPL0155', 'HOSPL0157', 'HOSPL0158', 'HOSPL0180', 'HOSPL0190', 'HOSPL0191', 'HOSPL0192', 'HOSPL0193', 'HOSPL0196', 'HOSPP0159', 'HOSPP0162', 'HOSPP0163', 'HOSPP0164', 'HOSPP0165', 'HOSPP0167', 'HOSPP0170', 'HOSPP0173', 'HOSPP0175', 'HOSPP0193', 'HOSPP0195', 'HOSPP0196', 'HOSPP0197', 'HOSPP0198', 'HOSPP0199', 'HOSPP0200', 'HOSPP0201', 'HOSPP0202', 'HOSPP0203', 'HOSPR0178', 'HOSPR0180', 'HOSPR0181', 'HOSPR0182', 'HOSPR0183', 'HOSPR0184', 'HOSPR0185', 'HOSPR0186', 'HOSPT0037', 'LTC001000', 'LTC001001', 'LTC001002', 'LTC001005', 'LTC001008', 'LTC001009', 'LTC1001390', 'LTC10031068', 'LTC10051032', 'LTC10051492', 'LTC10051527', 'LTC10051742', 'LTC10071100', 'LTC10081231', 'LTC10081369', 'LTC1009941', 'LTC1009992', 'LTC10101119', 'LTC10111078', 'LTC10111095', 'LTC10111214', 'LTC10111664', 'LTC10111944', 'LTC1011218', 'LTC1011719', 'LTC1011923', 'LTC1011952', 'LTC1011969', 'LTC1011978', 'LTC1012711', 'LTC10131392', 'LTC10151478', 'LTC10161084', 'LTC10161178', 'LTC1016601', 'LTC1016605', 'LTC10171043', 'LTC1017501', 'LTC1018173', 'LTC1019314', 'LTC10201098', 'LTC10211071', 'LTC10211085', 'LTC10211115', 'LTC10221133', 'LTC10221134', 'LTC10221149', 'LTC10221170', 'LTC10231207', 'LTC1023950', 'LTC10241023', 'LTC10251060', 'LTC10251096', 'LTC10251158', 'LTC10251228', 'LTC10251271', 'LTC10251469', 'LTC10251480', 'LTC10251500', 'LTC10251850', 'LTC1025456', 'LTC1025460', 'LTC1025465', 'LTC1025984', 'LTC1027448', 'LTC10281164', 'LTC10281183', 'LTC10281425', 'LTC1029217', 'LTC1029602', 'LTC1029953', 'LTC1029964', 'LTC10301168', 'LTC10311222', 'LTC10311341', 'LTC10311409', 'LTC1031928', 'LTC1032839', 'LTC10331156', 'LTC10331172', 'LTC10331185', 'LTC10331225', 'LTC10331268', 'LTC10331423', 'LTC10331426', 'LTC10331490', 'LTC10331565', 'LTC1033971', 'LTC1034297', 'LTC10351180', 'LTC1035150', 'LTC1035866', 'LTC1035935', 'LTC10361197', 'LTC10361260', 'LTC1036959', 'LTC1037882', 'LTC10381717', 'LTC1038235', 'LTC10391080', 'LTC10401033', 'LTC1040870', 'LTC10411187', 'LTC10431146', 'LTC1043500', 'LTC10441005', 'LTC1044102', 'LTC10441114', 'LTC10441221', 'LTC10441435', 'LTC10441550', 'LTC10441825', 'LTC1044225', 'LTC1044323', 'LTC1044350', 'LTC1044395', 'LTC1044444', 'LTC1044801', 'LTC1044817', 'LTC1044909', 'LTC1044945', 'LTC10451015', 'LTC1045618', 'LTC10461117', 'LTC1047703', 'LTC1047916', 'LTC1048895', 'LTC1049409', 'LTC1051315', 'LTC1052943', 'LTC1052967', 'LTC10531024', 'LTC10531507', 'LTC1053334', 'LTC10541083', 'LTC10551198', 'LTC10561184', 'LTC10561495', 'LTC10571104', 'LTC10571140', 'LTC10571176', 'LTC10571922', 'LTC10571935', 'LTC1057462', 'LTC1057809', 'LTC10581126', 'LTC10581216', 'LTC1059485', 'LTC1060081', 'LTC10601001', 'LTC10601009', 'LTC10601010', 'LTC10601123', 'LTC10601130', 'LTC10601166', 'LTC10601219', 'LTC10601220', 'LTC1060142', 'LTC10601644', 'LTC10601879', 'LTC10601886', 'LTC1060275', 'LTC1060280', 'LTC1060555', 'LTC1060811', 'LTC1060828', 'LTC1060974', 'LTC10611232', 'LTC10621049', 'LTC10631206', 'LTC10631430', 'LTC10631887', 'LTC10631918', 'LTC1064029', 'LTC1064912', 'LTC1065858', 'LTC10661210', 'LTC1066901', 'LTC10671027', 'LTC10671048', 'LTC10671048L', 'LTC10671176', 'LTC10671186', 'LTC10671298', 'LTC10671553', 'LTC10671738', 'LTC1067670', 'LTC1067820', 'LTC1068299', 'LTC1068857', 'LTC1069012', 'LTC10691175', 'LTC10691194', 'LTC10691224', 'LTC10691368', 'LTC10691740', 'LTC10701061', 'LTC10701086', 'LTC10711432', 'LTC1071813', 'LTC10731132', 'LTC10731137', 'LTC1074647', 'LTC10751497', 'LTC10751648', 'LTC1076028', 'LTC10761106', 'LTC1076686', 'LTC1076997', 'LTC10771111', 'LTC10771331', 'LTC1077208', 'LTC10781735', 'LTC1078292', 'LTC10791047', 'LTC10801162', 'LTC1081372', 'LTC1081542', 'LTC1082014', 'LTC10831406', 'LTC1083770', 'LTC10841491', 'LTC10841493', 'LTC10851152', 'LTC1086346', 'LTC10871021', 'LTC10871290', 'LTC1087963', 'LTC10881474', 'LTC1089991', 'LTC10911062', 'LTC1092936', 'LTC1092937', 'LTC1092951', 'LTC10931188', 'LTC10941107', 'LTC1094120', 'LTC1094999', 'LTC1095955', 'LTC10961171', 'LTC1097368', 'LTC10991465', 'LTC1100247', 'LTC1101112', 'LTC1101256', 'LTC11021004', 'LTC11021016', 'LTC1102683', 'LTC11041064', 'LTC11051014', 'LTC11061155', 'LTC11061200', 'LTC11061205', 'LTC11061405', 'LTC11061839', 'LTC1106385', 'LTC11071012', 'LTC1108942', 'LTC11091173', 'LTC1110214', 'LTC11111073', 'LTC11121215', 'LTC1112622', 'LTC11131108', 'LTC11151157', 'LTC11151231', 'LTC1116927', 'LTC1117986', 'LTC11191190', 'LTC1120446', 'LTC11211011', 'LTC11211026', 'LTC11211041', 'LTC11211092', 'LTC11211227', 'LTC11211951', 'LTC1121253', 'LTC1121296', 'LTC1121694', 'LTC1121966', 'LTC1121985', 'LTC11221496', 'LTC11221567', 'LTC1124998', 'LTC11251088', 'LTC11251211', 'LTC11261150', 'LTC1126623', 'LTC1126875', 'LTC1127371', 'LTC11281199', 'LTC1129065', 'LTC11291066', 'LTC11321079', 'LTC1132926', 'LTC11331234', 'LTC11341099', 'LTC11341428', 'LTC11351006', 'LTC11361090', 'LTC11361429', 'LTC1136976', 'LTC1137704', 'LTC1137893', 'LTC1138015', 'LTC11381151', 'LTC11391388', 'LTC1140180', 'LTC11411424', 'LTC1141919', 'LTC11421163', 'LTC11431437', 'LTC1144612', 'LTC11451082', 'LTC11451494', 'LTC1145889', 'LTC11461125', 'LTC11461209', 'LTC11461213L', 'LTC11461413', 'LTC11471218', 'LTC1147904', 'LTC11481167', 'LTC1149713', 'LTC1150135', 'LTC1150258', 'LTC1151815', 'LTC1151899', 'LTC1151933', 'LTC11531798', 'LTC11541189', 'LTC11551159', 'LTC11551568', 'LTC1155425', 'LTC1155885', 'LTC11561017', 'LTC11561212', 'LTC11571226', 'LTC11581230', 'LTC1159702', 'LTC1382013', 'LTC1441361', 'LTC20331192', 'LTC2033160', 'LTC2038962', 'LTC2044459', 'LTC2052981', 'LTC20601091', 'LTC2060211', 'LTC2063522', 'LTC2071841', 'LTC2072511', 'LTC2076970', 'LTC2092939', 'LTC2099910', 'LTC21060996', 'LTC21071019', 'LTC2112925', 'LTC21145640', 'LTC21151136', 'LTC2136886', 'LTC2141724', 'LTC2148010', 'LTC2148949', 'LTC21501045', 'LTC21541265', 'OEMS0001', 'OEMS0002', 'OEMS0003', 'OEMS0004', 'OEMS0005', 'OEMS0006', 'OEMS0007', 'OEMS0008', 'OEMS0009', 'OEMS0010', 'OEMS0011', 'OEMS0012', 'OEMS0013', 'OEMS0014', 'OEMS0015', 'OEMS0016', 'OEMS0017', 'OEMS0018', 'OEMS0019', 'OEMS0020', 'OEMS0021', 'OEMS0022', 'OEMS0023', 'OEMS0103', 'OEMS0104', 'OEMS0105', 'OEMS0106', 'OEMS0107', 'OEMS0108', 'OEMS0109', 'OEMS0110', 'OEMS0111', 'OEMS0112', 'OEMS0203', 'OEMS0204', 'OEMS0205', 'OEMS0206', 'OEMS0207', 'OEMS0208', 'OEMS0209', 'OEMS0210', 'OEMS0211', 'OEMS0300', 'OEMS0301', 'OEMS0302', 'OEMS0304', 'OEMS0305', 'OEMS0306', 'OEMS0307', 'OEMS0308', 'OEMS0309', 'OEMS0310', 'OEMS0311', 'OEMS0312', 'OEMS0313', 'OEMS0314', 'OEMS0401', 'OEMS0402', 'OEMS0403', 'OEMS0404', 'OEMS0405', 'OEMS0406', 'OEMS0407', 'OEMS0408', 'OEMS0409', 'OEMS0411', 'OEMS0412', 'OEMS0413', 'OEMS0501', 'OEMS0502', 'OEMS0503', 'OEMS0504', 'OEMS0505', 'OEMS0506', 'OEMS0507', 'OEMS0508', 'OEMS0509', 'OEMS0510', 'OEMS0511', 'OEMS0512', 'OEMS0513', 'OEMS0514', 'OEMS0515', 'OEMS0516', 'OEMS0517', 'OEMS0518', 'OEMS0519', 'OEMS0520 ', 'OEMS0521', 'OEMS0522', 'OEMS0523', 'OEMS0524', 'OEMS0525', 'OEMS0526', 'OEMS0600', 'OEMS0601', 'OEMS0603', 'OEMS0604', 'OEMS0605', 'OEMS0606', 'OEMS0607', 'OEMS0608', 'OEMS0609', 'OEMS0610', 'OEMS0611', 'OEMS0612', 'OEMS0613', 'OEMS0614', 'OEMS0615', 'OEMS0616', 'OEMS0618', 'OEMS0619', 'OEMS0620', 'OEMS0622', 'OEMS0623', 'OEMS0624', 'OEMS0625', 'OEMS0626', 'OEMS0627', 'OEMS0628', 'OEMS0629', 'OEMS0630', 'OEMS0631', 'OEMS0632', 'OEMS0633', 'OEMS0634', 'OEMS0635', 'OEMS0636', 'OEMS0637', 'OEMS0638', 'OEMS0639', 'OEMS0640', 'OEMS0641', 'OEMS0642', 'OEMS0643', 'OEMS0644', 'OEMS0645', 'OEMS0646', 'OEMS0647', 'OEMS0648', 'OEMS0649', 'OEMS0650', 'OEMS0651', 'OEMS0653', 'OEMS0657', 'OEMS0658', 'OEMS0659', 'OEMS0660', 'OEMS0661', 'OEMS0662', 'OEMS0663', 'OEMS0664', 'OEMS0665', 'OEMS0666', 'OEMS0667', 'OEMS0669', 'OEMS0670', 'OEMS0671', 'OEMS0672', 'OEMS0673', 'OEMS0674', 'OEMS0675', 'OEMS0676', 'OEMS0677', 'OEMS0678', 'OEMS0701', 'OEMS0702', 'OEMS0703', 'OEMS0704', 'OEMS0705', 'OEMS0706', 'OEMS0707', 'OEMS0708', 'OEMS0709', 'OEMS0710', 'OEMS0711', 'OEMS0712', 'OEMS0713', 'OEMS0714', 'OEMS0715', 'OEMS0716', 'OEMS0717', 'OEMS0718', 'OEMS0719', 'OEMS0720', 'OEMS0721', 'OEMS0722', 'OEMS0723', 'OEMS0724', 'OEMS0725', 'OEMS0726', 'OEMS0727', 'OEMS0728', 'OEMS0729', 'OEMS0730', 'OEMS0731', 'OEMS0732', 'OEMS0733', 'OEMS0734', 'OEMS0735', 'OEMS0736', 'OEMS0737', 'OEMS0738', 'OEMS0739', 'OEMS0740', 'OEMS0741', 'OEMS0742', 'OEMS0743', 'OEMS0744', 'OEMS0745', 'OEMS0746', 'OEMS0747', 'OEMS0751', 'OEMS0752', 'OEMS0753', 'OEMS0754', 'OEMS9999', 'OESM0618', 'PCH000103', 'PCH000437', 'PCH000542', 'PCH000581', 'PCH000901', 'PCH001004', 'PCH001008', 'PCH001024', 'PCH001028', 'PCH001031', 'PCH001035', 'PCH001049', 'PCH001051', 'PCH001060', 'PCH001063', 'PCH001071', 'PCH001072', 'PCH001073', 'PCH001091', 'PCH001093', 'PCH001094', 'PCH001096', 'PCH001098', 'PCH001099', 'PCH001106', 'PCH001110', 'PCH001111', 'PCH001117', 'PCH001129', 'PCH001130', 'PCH001131', 'PCH001134', 'PCH001137', 'PCH001145', 'PCH001148', 'PCH001149', 'PCH001159', 'PCH001172', 'PCH001175', 'PCH001177', 'PCH001186', 'PCH001199', 'PCH001210', 'PCH001215', 'PCH001219', 'PCH001222', 'PCH001227', 'PCH001249', 'PCH001268', 'PCH001280', 'PCH001282', 'PCH001284', 'PCH001286', 'PCH001298', 'PCH001300', 'PCH001310', 'PCH001320', 'PCH001331', 'PCH001337', 'PCH001338', 'PCH001341', 'PCH001342', 'PCH001350', 'PCH001354', 'PCH001358', 'PCH001360', 'PCH001363', 'PCH001365', 'PCH001367', 'PCH001370', 'PCH001377', 'PCH001379', 'PCH001383', 'PCH001386', 'PCH001388', 'PCH001390', 'PCH001397', 'PCH001400', 'PCH001402', 'PCH001404', 'PCH001412', 'PCH001420', 'PCH001429', 'PCH001435', 'PCH001437', 'PCH001443', 'PCH001445', 'PCH001447', 'PCH001453', 'PCH001455', 'PCH001458', 'PCH001459', 'PCH001460', 'PCH001465', 'PCH001472', 'PCH001474', 'PCH001475', 'PCH001476', 'PCH001481', 'PCH001482', 'PCH001484', 'PCH001489', 'PCH001491', 'PCH001498', 'PCH001500', 'PCH001503', 'PCH001506', 'PCH001507', 'PCH001511', 'PCH001514', 'PCH001515', 'PCH001521', 'PCH001522', 'PCH001523', 'PCH001525', 'PCH001540', 'PCH001553', 'PCH001556', 'PCH001558', 'PCH001563', 'PCH001584', 'PCH001585', 'PCH001589', 'PCH001605', 'PCH001612', 'PCH001613', 'PCH001616', 'PCH001618', 'PCH001620', 'PCH001621', 'PCH001623', 'PCH001624', 'PCH001625', 'PCH001626', 'PCH001627', 'PCH001629', 'PCH001631', 'PCH001641', 'PCH001642', 'PCH001644', 'PCH001647', 'PCH001666', 'PCH001670', 'PCH001677', 'PCH001679', 'PCH001684', 'PCH001685', 'PCH001686', 'PCH001687', 'PCH001696', 'PCH001704', 'PCH001717', 'PCH001725', 'PCH001729', 'PCH001734', 'PCH001736', 'PCH001737', 'PCH001738', 'PCH001747', 'PCH001748', 'PCH001759', 'PCH001761', 'PCH001762', 'PCH001777', 'PCH001779', 'PCH001780', 'PCH001786', 'PCH001789', 'PCH001790', 'PCH001794', 'PCH001796', 'PCH001799', 'PCH001802', 'PCH001803', 'PCH001826', 'PCH001842', 'PCH001847', 'PCH001851', 'PCH001853', 'PCH001855', 'PCH001858', 'PCH001869', 'PCH001874', 'PCH001877', 'PCH001879', 'PCH001881', 'PCH001882', 'PCH001886', 'PCH001887', 'PCH001892', 'PCH001893', 'PCH001895', 'PCH001896', 'PCH001917', 'PCH001948', 'PCH001949', 'PCH001957', 'PCH001963', 'PCH001966', 'PCH001988', 'PCH001991', 'PCH001993', 'PCH002002', 'PCH002010', 'PCH002016', 'PCH002024', 'PCH002039', 'PCH002063', 'PCH002064', 'PCH002067', 'PCH002068', 'PCH002069', 'PCH002073', 'PCH002076', 'PCH002078', 'PCH002081', 'PCH002083', 'PCH002084', 'PCH002085', 'PCH002086', 'PCH002093', 'PCH002098', 'PCH002100', 'PCH002104', 'PCH002108', 'PCH002115', 'PCH002125', 'PCH002128', 'PCH002130', 'PCH002131', 'PCH002132', 'PCH002152', 'PCH002167', 'PCH002168', 'PCH002170', 'PCH002171', 'PCH002174', 'PCH002176', 'PCH002177', 'PCH002178', 'PCH002184', 'PCH002190', 'PCH002198', 'PCH002199', 'PCH002202', 'PCH002205', 'PCH002208', 'PCH002209', 'PCH002214', 'PCH002216', 'PCH002227', 'PCH002229', 'PCH002243', 'PCH002244', 'PCH002249', 'PCH002251', 'PCH002253', 'PCH002256', 'PCH002258', 'PCH002260', 'PCH002264', 'PCH002265', 'PCH002273', 'PCH002274', 'PCH002282', 'PCH002285', 'PCH002286', 'PCH002287', 'PCH002289', 'PCH002293', 'PCH002302', 'PCH002304', 'PCH002308', 'PCH002309', 'PCH002311', 'PCH002320', 'PCH002332', 'PCH002342', 'PCH002345', 'PCH002348', 'PCH002357', 'PCH002358', 'PCH002362', 'PCH002368', 'PCH002370', 'PCH002383', 'PCH002385', 'PCH002390', 'PCH002404', 'PCH002405', 'PCH002409', 'PCH002410', 'PCH002411', 'PCH002413', 'PCH002415', 'PCH002425', 'PCH002430', 'PCH002433', 'PCH002435', 'PCH002437', 'PCH002438', 'PCH002452', 'PCH002453', 'PCH002461', 'PCH002466', 'PCH002468', 'PCH002471', 'PCH002472', 'PCH002474', 'PCH002475', 'PCH002486', 'PCH002487', 'PCH002497', 'PCH002498', 'PCH002500', 'PCH002502', 'PCH002505', 'PCH002507', 'PCH002508', 'PCH002520', 'PCH002524', 'PCH002525', 'PCH002533', 'PCH002536', 'PCH002538', 'PCH002539', 'PCH002541', 'PCH002542', 'PCH002544', 'PCH002545', 'PCH002546', 'PCH002547', 'PCH002548', 'PCH002551', 'PCH002556', 'PCH002563', 'PCH002567', 'PCH002568', 'PCH002573', 'PCH002577', 'PCH002579', 'PCH002585', 'PCH002586', 'PCH002587', 'PCH002589', 'PCH002598', 'PCH002602', 'PCH002605', 'PCH002610', 'PCH002614', 'PCH002617', 'PCH002620', 'PCH002623', 'PCH002625', 'PCH002626', 'PCH002627', 'PCH002632', 'PCH002640', 'PCH002642', 'PCH002646', 'PCH002650', 'PCH002666', 'PCH002671', 'PCH002680', 'PCH002694', 'PCH002705', 'PCH002715', 'PCH002716', 'PCH002717', 'PCH002719', 'PCH002725', 'PCH002726', 'PCH002734', 'PCH002760', 'PCH002761', 'PCH002767', 'PCH002773', 'PCH002774', 'PCH002777', 'PCH002781', 'PCH002801', 'PCH002846', 'PCH002847', 'PCH002850', 'PCH002861', 'PCH002863', 'PCH002864', 'PCH002911', 'PCH002925', 'PCH002927', 'PCH002934', 'PCH002935', 'PCH002943', 'PCH002947', 'PCH002951', 'PCH002957', 'PCH002960', 'PCH002962', 'PCH002969', 'PCH002973', 'PCH002985', 'PCH002992', 'PCH002998', 'PCH003008', 'PCH003015', 'PCH003039', 'PCH003051', 'PCH003076', 'PCH003082', 'PCH003095', 'PCH003121', 'PCH003136', 'PCH003156', 'PCH003164', 'PCH003167', 'PCH003176', 'PCH003177', 'PCH003180', 'PCH003187', 'PCH003205', 'PCH003206', 'PCH003216', 'PCH003218', 'PCH003224', 'PCH003227', 'PCH003231', 'PCH003250', 'PCH003253', 'PCH003254', 'PCH003266', 'PCH003269', 'PCH003272', 'PCH003286', 'PCH003294', 'PCH003334', 'PCH003341', 'PCH003346', 'PCH003360', 'PCH003386', 'PCH003424', 'PCH003427', 'PCH003430', 'PCH003450', 'PCH003457', 'PCH003499', 'PCH003513', 'PCH003517', 'PCH003518', 'PCH003522', 'PCH003538', 'PCH003558', 'PCH003562', 'PCH003563', 'PCH003588', 'PCH003598', 'PCH003607', 'PCH003610', 'PCH003616', 'PCH003629', 'PCH003640', 'PCH003663', 'PCH003670', 'PCH003680', 'PCH003692', 'PCH003706', 'PCH003708', 'PCH003712', 'PCH003719', 'PCH003748', 'PCH003756', 'PCH003759', 'PCH003767', 'PCH003858', 'PCH003872', 'PCH003882', 'PCH003928', 'PCH003941', 'PCH003946', 'PCH003962', 'PCH003982', 'PCH003986', 'PCH003988', 'PCH004010', 'PCH004012', 'PCH004021', 'PCH004040', 'PCH004046', 'PCH004064', 'PCH004068', 'PCH004086', 'PCH004096', 'PCH004152', 'PCH004193', 'PCH004214', 'PCH004217', 'PCH004236', 'PCH004240', 'PCH004241', 'PCH004244', 'PCH004246', 'PCH004257', 'PCH004264', 'PCH004274', 'PCH004280', 'PCH004290', 'PCH004299', 'PCH004304', 'PCH004307', 'PCH004309', 'PCH004311', 'PCH004331', 'PCH004336', 'PCH004350', 'PCH004360', 'PCH004364', 'PCH004367', 'PCH004373', 'PCH004376', 'PCH004379', 'PCH004383', 'PCH004387', 'PCH004390', 'PCH004394', 'PCH004396', 'PCH004406', 'PCH004414', 'PCH004428', 'PCH004439', 'PCH004440', 'PCH004473', 'PCH004476', 'PCH004483', 'PCH004500', 'PCH004502', 'PCH004503', 'PCH004512', 'PCH004518', 'PCH004520', 'PCH004526', 'PCH004535', 'PCH004542', 'PCH004544', 'PCH004561', 'PCH004565', 'PCH004570', 'PCH004577', 'PCH004607', 'PCH004626', 'PCH004635', 'PCH004640', 'PCH004643', 'PCH004645', 'PCH004648', 'PCH004652', 'PCH004653', 'PCH004662', 'PCH004665', 'PCH004667', 'PCH004670', 'PCH004679', 'PCH004683', 'PCH004685', 'PCH004686', 'PCH004687', 'PCH004688', 'PCH004695', 'PCH004701', 'PCH004706', 'PCH004714', 'PCH004719', 'PCH004721', 'PCH004722', 'PCH004740', 'PCH004747', 'PCH004755', 'PCH004762', 'PCH004763', 'PCH004764', 'PCH004766', 'PCH004768', 'PCH004770', 'PCH004774', 'PCH004784', 'PCH004786', 'PCH004790', 'PCH004799', 'PCH004800', 'PCH004805', 'PCH004806', 'PCH004824', 'PCH004830', 'PCH004836', 'PCH004855', 'PCH004858', 'PCH004861', 'PCH004866', 'PCH004892', 'PCH004896', 'PCH004903', 'PCH004909', 'PCH004924', 'PCH004933', 'PCH004937', 'PCH004943', 'PCH004944', 'PCH004953', 'PCH004972', 'PCH004973', 'PCH004975', 'PCH004979', 'PCH004982', 'PCH004985', 'PCH005010', 'PCH005012', 'PCH005014', 'PCH005021', 'PCH005034', 'PCH005040', 'PCH005050', 'PCH005063', 'PCH005068', 'PCH005070', 'PCH005076', 'PCH005084', 'PCH005089', 'PCH005090', 'PCH005092', 'PCH005096', 'PCH005098', 'PCH005101', 'PCH005102', 'PCH005103', 'PCH005127', 'PCH005128', 'PCH005133', 'PCH005164', 'PCH005168', 'PCH005188', 'PCH005193', 'PCH005198', 'PCH005206', 'PCH005207', 'PCH005210', 'PCH005220', 'PCH005221', 'PCH005230', 'PCH005233', 'PCH005237', 'PCH005241', 'PCH005242', 'PCH005250', 'PCH005252', 'PCH005256', 'PCH005263', 'PCH005265', 'PCH005274', 'PCH005280', 'PCH005282', 'PCH005286', 'PCH005287', 'PCH005314', 'PCH005323', 'PCH005324', 'PCH005331', 'PCH005337', 'PCH005338', 'PCH005344', 'PCH005346', 'PCH005348', 'PCH005350', 'PCH005362', 'PCH005368', 'PCH005370', 'PCH005373', 'PCH005374', 'PCH005378', 'PCH005399', 'PCH005402', 'PCH005412', 'PCH005424', 'PCH005441', 'PCH005446', 'PCH005456', 'PCH005460', 'PCH005467', 'PCH005469', 'PCH005477', 'PCH005478', 'PCH005502', 'PCH005507', 'PCH005512', 'PCH005514', 'PCH005515', 'PCH005523', 'PCH005528', 'PCH005540', 'PCH005542', 'PCH005543', 'PCH005549', 'PCH005550', 'PCH005565', 'PCH005573', 'PCH005574', 'PCH005582', 'PCH005585', 'PCH005586', 'PCH005595', 'PCH005599', 'PCH005605', 'PCH005607', 'PCH005613', 'PCH005614', 'PCH005615', 'PCH005616', 'PCH005620', 'PCH005621', 'PCH005624', 'PCH005625', 'PCH005628', 'PCH005636', 'PCH005641', 'PCH005647', 'PCH005652', 'PCH005654', 'PCH005658', 'PCH005661', 'PCH005663', 'PCH005666', 'PCH005684', 'PCH005697', 'PCH005701', 'PCH005706', 'PCH005712', 'PCH005715', 'PCH005723', 'PCH005732', 'PCH005746', 'PCH005753', 'PCH005755', 'PCH005768', 'PCH005772', 'PCH005780', 'PCH005782', 'PCH005784', 'PCH005785', 'PCH005790', 'PCH005829', 'PCH005831', 'PCH005843', 'PCH005847', 'PCH005851', 'PCH005859', 'PCH005863', 'PCH005869', 'PCH005871', 'PCH005883', 'PCH005888', 'PCH005909', 'PCH005915', 'PCH005925', 'PCH005927', 'PCH005929', 'PCH005935', 'PCH005939', 'PCH005943', 'PCH005947', 'PCH005955', 'PCH005957', 'PCH005983', 'PCH005989', 'PCH005997', 'PCH006005', 'PCH006027', 'PCH006032', 'PCH006033', 'PCH006034', 'PCH006036', 'PCH006039', 'PCH006042', 'PCH006043', 'PCH006044', 'PCH006063', 'PCH006071', 'PCH006093', 'PCH006119', 'PCH006141', 'PCH006151', 'PCH006157', 'PCH006169', 'PCH006191', 'PCH006193', 'PCH006194', 'PCH006199', 'PCH006202', 'PCH006203', 'PCH006303', 'PCH006309', 'PCH006319', 'PCH006329', 'PCH006333', 'PCH006337', 'PCH006341', 'PCH006353', 'PCH006357', 'PCH006371', 'PCH006379', 'PCH006411', 'PCH006413', 'PCH006416', 'PCH006424', 'PCH006429', 'PCH006430', 'PCH006434', 'PCH006438', 'PCH006441', 'PCH006445', 'PCH006446', 'PCH006456', 'PCH006459', 'PCH006462', 'PCH006469', 'PCH006472', 'PCH006476', 'PCH006477', 'PCH006479', 'PCH006480', 'PCH006486', 'PCH006491', 'PCH006494', 'PCH006519', 'PCH006520', 'PCH006530', 'PCH006545', 'PCH006547', 'PCH006553', 'PCH006565', 'PCH006569', 'PCH006575', 'PCH006591', 'PCH006602', 'PCH006614', 'PCH006615', 'PCH006616', 'PCH006621', 'PCH006637', 'PCH006647', 'PCH006663', 'PCH006677', 'PCH006679', 'PCH006683', 'PCH006687', 'PCH006689', 'PCH006691', 'PCH006700', 'PCH006701', 'PCH006705', 'PCH006709', 'PCH006719', 'PCH006732', 'PCH006737', 'PCH006741', 'PCH006753', 'PCH006759', 'PCH006762', 'PCH006768', 'PCH006770', 'PCH006784', 'PCH006789', 'PCH006795', 'PCH006797', 'PCH006799', 'PCH006801', 'PCH006805', 'PCH006817', 'PCH006827', 'PCH006838', 'PCH006847', 'PCH006853', 'PCH006856', 'PCH006857', 'PCH006866', 'PCH006867', 'PCH006881', 'PCH006890', 'PCH006892', 'PCH006894', 'PCH006912', 'PCH006927', 'PCH006935', 'PCH006942', 'PCH006944', 'PCH006946', 'PCH006948', 'PCH006954', 'PCH006963', 'PCH006973', 'PCH007005', 'PCH007034', 'PCH007047', 'PCH007059', 'PCH007079', 'PCH007081', 'PCH007101', 'PCH007107', 'PCH007109', 'PCH007114', 'PCH007121', 'PCH007123', 'PCH007134', 'PCH007153', 'PCH007157', 'PCH007169', 'PCH007172', 'PCH007175', 'PCH007181', 'PCH007183', 'PCH007185', 'PCH007191', 'PCH007200', 'PCH007209', 'PCH007217', 'PCH007225', 'PCH007259', 'PCH007265', 'PCH007286', 'PCH007291', 'PCH007295', 'PCH007297', 'PCH007307', 'PCH007333', 'PCH007341', 'PCH007351', 'PCH007353', 'PCH007367', 'PCH007383', 'PCH007385', 'PCH007390', 'PCH007401', 'PCH007403', 'PCH007407', 'PCH007415', 'PCH007417', 'PCH007437', 'PCH007443', 'PCH007459', 'PCH007465', 'PCH007466', 'PCH007475', 'PCH007491', 'PCH007493', 'PCH007495', 'PCH007505', 'PCH007519', 'PCH007522', 'PCH007543', 'PCH007549', 'PCH007551', 'PCH007553', 'PCH007560', 'PCH007561', 'PCH007573', 'PCH007583', 'PCH007599', 'PCH007601', 'PCH007609', 'PCH007610', 'PCH007622', 'PCH007624', 'PCH007659', 'PCH007667', 'PCH007669', 'PCH007671', 'PCH007673', 'PCH007677', 'PCH007679', 'PCH007681', 'PCH007683', 'PCH007701', 'PCH007703', 'PCH007707', 'PCH007713', 'PCH007723', 'PCH007731', 'PCH007735', 'PCH007738', 'PCH007740', 'PCH007749', 'PCH007751', 'PCH007753', 'PCH007756', 'PCH007762', 'PCH007767', 'PCH007769', 'PCH007771', 'PCH007773', 'PCH007775', 'PCH007781', 'PCH007785', 'PCH007787', 'PCH007789', 'PCH007791', 'PCH007793', 'PCH007805', 'PCH007810', 'PCH007821', 'PCH007822', 'PCH007825', 'PCH007828', 'PCH007830', 'PCH007832', 'PCH007837', 'PCH007838', 'PCH007839', 'PCH007841', 'PCH007843', 'PCH007847', 'PCH007849', 'PCH007850', 'PCH007855', 'PCH007867', 'PCH007873', 'PCH007879', 'PCH007883', 'PCH007917', 'PCH007941', 'PCH007952', 'PCH007953', 'PCH007961', 'PCH007962', 'PCH007964', 'PCH007966', 'PCH007974', 'PCH007975', 'PCH007978', 'PCH007982', 'PCH007987', 'PCH007989', 'PCH007991', 'PCH008003', 'PCH008009', 'PCH008012', 'PCH008014', 'PCH008016', 'PCH008033', 'PCH008034', 'PCH008036', 'PCH008038', 'PCH008048', 'PCH008060', 'PCH008070', 'PCH008076', 'PCH008082', 'PCH008090', 'PCH008096', 'PCH008106', 'PCH008109', 'PCH008116', 'PCH008120', 'PCH008126', 'PCH008128', 'PCH008130', 'PCH008131', 'PCH008133', 'PCH008134', 'PCH008139', 'PCH008140', 'PCH008141', 'PCH008145', 'PCH008148', 'PCH008150', 'PCH008152', 'PCH008156', 'PCH008157', 'PCH008158', 'PCH008159', 'PCH008160', 'PCH008161', 'PCH008164', 'PCH008166', 'PCH008168', 'PCH008169', 'PCH008173', 'PCH008174', 'PCH008178', 'PCH008183', 'PCH008185', 'PCH008186', 'PCH008187', 'PCH008188', 'PCH008189', 'PCH008190', 'PCH008192', 'PCH008196', 'PCH008197', 'PCH008198', 'PCH008199', 'PCH008205', 'PCH008217', 'PCH008220', 'PCH008222', 'PCH008226', 'PCH008227', 'PCH008230', 'PCH008233', 'PCH008236', 'PCH008242', 'PCH008244', 'PCH008247', 'PCH008248', 'PCH008252', 'PCH008255', 'PCH008256', 'PCH008259', 'PCH008260', 'PCH008267', 'PCH008269', 'PCH008270', 'PCH008271', 'PCH008272', 'PCH008273', 'PCH008276', 'PCH008279', 'PCH008281', 'PCH008292', 'PCH008296', 'PCH008299', 'PCH008302', 'PCH008304', 'PCH008305', 'PCH008306', 'PCH008308', 'PCH008311', 'PCH008313', 'PCH008316', 'PCH008317', 'PCH008318', 'PCH008319', 'PCH008320', 'PCH008322', 'PCH008325', 'PCH008328', 'PCH008330', 'PCH008331', 'PCH008333', 'PCH008334', 'PCH008335', 'PCH008337', 'PCH008338', 'PCH008342', 'PCH008344', 'PCH008346', 'PCH008348', 'PCH008349', 'PCH008350', 'PCH008351', 'PCH008352', 'PCH008355', 'PCH008357', 'PCH008358', 'PCH008359', 'PCH008360', 'PCH008361', 'PCH008365', 'PCH008367', 'PCH008368', 'PCH008369', 'PCH008374', 'PCH008375', 'PCH008379', 'PCH008380', 'PCH008383', 'PCH008384', 'PCH008386', 'PCH008388', 'PCH008389', 'PCH008390', 'PCH008391', 'PCH008396', 'PCH008397', 'PCH008400', 'PCH008402', 'PCH008404', 'PCH008405', 'PCH008408', 'PCH008409', 'PCH008410', 'PCH008411', 'PCH008417', 'PCH008418', 'PCH008422', 'PCH008424', 'PCH008425', 'PCH008427', 'PCH008429', 'PCH008430', 'PCH008433', 'PCH008435', 'PCH008439', 'PCH008441', 'PCH008442', 'PCH008443', 'PCH008444', 'PCH008445', 'PCH008446', 'PCH008447', 'PCH008449', 'PCH008450', 'PCH008451', 'PCH008453', 'PCH008454', 'PCH008455', 'PCH008456', 'PCH008457', 'PCH008458', 'PCH008461', 'PCH008462', 'PCH008463', 'PCH008464', 'PCH008465', 'PCH008466', 'PCH008468', 'PCH008469', 'PCH008472', 'PCH008473', 'PCH008474', 'PCH008475', 'PCH008476', 'PCH008477', 'PCH008478', 'PCH008479', 'PCH008480', 'PCH008481', 'PCH008484', 'PCH008485', 'PCH008487', 'PCH008488', 'PCH008491', 'PCH008492', 'PCH008493', 'PCH008497', 'PCH008499', 'PCH008500', 'PCH008503', 'PCH008504', 'PCH008505', 'PCH008506', 'PCH008507', 'PCH008508', 'PCH008509', 'PCH008510', 'PCH008511', 'PCH008512', 'PCH008513', 'PCH008515', 'PCH008516', 'PCH008517', 'PCH008518', 'PCH008521', 'PCH008523', 'PCH008524', 'PCH008525', 'PCH008527', 'PCH008529', 'PCH008530', 'PCH008532', 'PCH008534', 'PCH008535', 'PCH008537', 'PCH008538', 'PCH008541', 'PCH008543', 'PCH008544', 'PCH008545', 'PCH008546', 'PCH008548', 'PCH008549', 'PCH008550', 'PCH008553', 'PCH008555', 'PCH008556', 'PCH008557', 'PCH008558', 'PCH008559', 'PCH008563', 'PCH008565', 'PCH008569', 'PCH008570', 'PCH008572', 'PCH008573', 'PCH008574', 'PCH008576', 'PCH008577', 'PCH008579', 'PCH008580', 'PCH008581', 'PCH008582', 'PCH008585', 'PCH008586', 'PCH008587', 'PCH008588', 'PCH008589', 'PCH008590', 'PCH008593', 'PCH008594', 'PCH008595', 'PCH008596', 'PCH008597', 'PCH008598', 'PCH008599', 'PCH008602', 'PCH008603', 'PCH008604', 'PCH008608', 'PCH008610', 'PCH008611', 'PCH008612', 'PCH008615', 'PCH008617', 'PCH008620', 'PCH008623', 'PCH008625', 'PCH008626', 'PCH008627', 'PCH008628', 'PCH008629', 'PCH008630', 'PCH008631', 'PCH008632', 'PCH008633', 'PCH008634', 'PCH008635', 'PCH008636', 'PCH008637', 'PCH008639', 'PCH008640', 'PCH008641', 'PCH008642', 'PCH008644', 'PCH008645', 'PCH008646', 'PCH008647', 'PCH008650', 'PCH008652', 'PCH008653', 'PCH008654', 'PCH008655', 'PCH008656', 'PCH008657', 'PCH008658', 'PCH008659', 'PCH008662', 'PCH008663', 'PCH008665', 'PCH008666', 'PCH008667', 'PCH008668', 'PCH008671', 'PCH008672', 'PCH008674', 'PCH008675', 'PCH008676', 'PCH008677', 'PCH008681', 'PCH008682', 'PCH008684', 'PCH008685', 'PCH008686', 'PCH008687', 'PCH008690', 'PCH008691', 'PCH008692', 'PCH008693', 'PCH008695', 'PCH008696', 'PCH008697', 'PCH008698', 'PCH008700', 'PCH008701', 'PCH008702', 'PCH008703', 'PCH008704', 'PCH008706', 'PCH008707', 'PCH008708', 'PCH008709', 'PCH008710', 'PCH008711', 'PCH008712', 'PCH008713', 'PCH008714', 'PCH008715', 'PCH008716', 'PCH008717', 'PCH008718', 'PCH008720', 'PCH008721', 'PCH008722', 'PCH008723', 'PCH008724', 'PCH008725', 'PCH008726', 'PCH008727', 'PCH008728', 'PCH008729', 'PCH008731', 'PCH008732', 'PCH008733', 'PCH008734', 'PCH008736', 'PCH008737', 'PCH008738', 'PCH008739', 'PCH008741', 'PCH008742', 'PCH008743', 'PCH008745', 'PCH008746', 'PCH008747', 'PCH008750', 'PCH008751', 'PCH008752', 'PCH008753', 'PCH008754', 'PCH008755', 'PCH008756', 'PCH008757', 'PCH008758', 'PCH008760', 'PCH008761', 'PCH008762', 'PCH008765', 'PCH008767', 'PCH008768', 'PCH008769', 'PCH008770', 'PCH008771', 'PCH008772', 'PCH008773', 'PCH008774', 'PCH008775', 'PCH008776', 'PCH008777', 'PCH008778', 'PCH008779', 'PCH008780', 'PCH008781', 'PCH008783', 'PCH008784', 'PCH008785', 'PCH008787', 'PCH008788', 'PCH008789', 'PCH008790', 'PCH008792', 'PCH008793', 'PCH008794', 'PCH008795', 'PCH008796', 'PCH008797', 'PCH008798', 'PCH008799', 'PCH008800', 'PCH008801', 'PCH008888', 'PCH008890', 'PCH008891', 'PCH008892', 'PCH008894', 'PCH008895', 'PCH008896', 'PCH008897', 'PCH008991', 'PCH008993', 'PCH009008', 'PCH009009', 'PCH009010', 'PCH009011', 'PCH009012', 'PCH009014', 'PCH009015', 'PCH009017', 'PCH009018', 'PCH009020', 'PCH009021', 'PCH009022', 'PCH009024', 'PCH009025', 'PCH009027', 'PCH009028', 'PCH009029', 'PCH009032', 'PCH009033', 'PCH009034', 'PCH009038', 'PCH009039', 'PCH009040', 'PCH009041', 'PCH009045', 'PCH009048', 'PCH009049', 'PCH009050', 'PCH009052', 'PCH009053', 'PCH009055', 'PCH009056', 'PCH009060', 'PCH009065', 'PCH009066', 'PCH009068', 'PCH009069', 'PCH009070', 'PCH009071', 'PCH009072', 'PCH009073', 'PCH009074', 'PCH009075', 'PCH009076', 'PCH009078', 'PCH009079', 'PCH009080', 'PCH009082', 'PCH009084', 'PCH009086', 'PCH009087', 'PCH009088', 'PCH009089', 'PCH009090', 'PCH009093', 'PCH009094', 'PCH009097', 'PCH009102', 'PCH009103', 'PCH009104', 'PCH009106', 'PCH009108', 'PCH009109', 'PCH009112', 'PCH009116', 'PCH009117', 'PCH009118', 'PCH009121', 'PCH009122', 'PCH009124', 'PCH009126', 'PCH009127', 'PCH009130', 'PCH009131', 'PCH009132', 'PCH009136', 'PCH009139', 'PCH009143', 'PCH009145', 'PCH009148', 'PCH009150', 'PCH009151', 'PCH009155', 'PCH009157', 'PCH009158', 'PCH009159', 'PCH009162', 'PCH009163', 'PCH009194', 'PCH009752', 'PCH009755', 'PCH009806', 'PCH009826', 'PCH009833', 'PCH009895', 'PCH009900', 'PCH009902', 'PCH009990', 'PCH010001', 'PCH010010', 'PCH010023', 'PCH010049', 'PCH012121', 'OEMS0527','OEMS0528','OEMS0529','OEMS0530','OEMS0679','OEMS0680','OEMS0681','OEMS0683','OEMS0684','OEMS0685','OEMS0686','OEMS0687','OEMS0688','OEMS0689','OEMS0690','OEMS061','OEMS0692','OEMS0693','OEMS0694','OEMS0695','OEMS0696','OEMS0697','ESRD001338','ESRD001410','ESRD001440','ESRD001443', 'OEMS0698', 'OEMS0699', 'OEMS0700', 'ALC000658', 'ALC000544', 'OEMS0748', 'OEMS0749', 'OEMS0750', 'LTC001016', 'OEMS0531', 'OEMS0755', 'OEMS0756', 'OEMS0757', 'OEMS0758', 'OEMS0759', 'OEMS0760', 'OEMS0761', 'OEMS0762', 'OEMS0763', 'OEMS0764', 'ALC000674', 'OEMS0765', 'OEMS0766', 'OEMS0767', 'OEMS0768', 'HOSP042871', 'HOSP042818', 'HOSPR0187', 'OEMS0024', 'OEMS0769', 'OEMS0770', 'OEMS0771', 'OEMS0772', 'OEMS0773', 'OEMS0774', 'OEMS0315', 'OEMS0414', 'OEMS0415', 'OEMS0416', 'OEMS0417', 'OEMS0418', 'OEMS0419', 'OEMS0420', 'OEMS0421', 'OEMS0422','OEMS0775', 'OEMS0776', 'OEMS0777','OEMS0778', 'OEMS0779'
))])">Submitted value for Destination Code (eDisposition.02) does not exist in the system.</sch:assert>
			</sch:rule>
		</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eHistory.CurrentMedsGroup related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory">
			<sch:let name="nemsisElements" value="nem:eHistory.CurrentMedsGroup" />
			<sch:assert id="Rule_4997" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001','4228003','4228005') and (count(nem:eHistory.CurrentMedsGroup/nem:*[@* or string-length(normalize-space(.)) &gt; 0]) = 0))">Current Medication/s is required with patient evaluation. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eHistory.12 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eHistory/nem:eHistory.CurrentMedsGroup">
			<sch:let name="nemsisElements" value="nem:eHistory.12" />
			<sch:assert id="Rule_4998" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.28 = ('4228001','4228003','4228005') and (not(nem:eHistory.12) or nem:eHistory.12 = '') and (not(nem:eHistory.12[@PN])))">Current Medication/s is required with patient evaluation. Enter value or select Pertinent Negative.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>itExam.088 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport">
			<sch:let name="nemsisElements" value="nem:itExam.088" />
			<sch:assert id="Rule_5012" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((not(nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.088']) or nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.088'][nem:eCustomResults.01 = '']) and nem:eDisposition/nem:eDisposition.IncidentDispositionGroup/nem:eDisposition.27 = '4227001' and nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-05-01T00:00:00'))">Possible Stroke Not Documented.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eExam.21 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eExam">
			<sch:let name="nemsisElements" value="nem:eExam.21" />
			<sch:assert id="Rule_5013" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.088'][nem:eCustomResults.01 = 'itExam.088.100'] and (not(nem:eExam.21) or nem:eExam.21 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-05-01T00:00:00'))">Stroke/CVA symptoms resolved is required on all possible stroke patients. Pertinent Negatives and Not Values are NOT accepted. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eSituation.18 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eSituation">
			<sch:let name="nemsisElements" value="nem:eSituation.18" />
			<sch:assert id="Rule_5016" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.088'][nem:eCustomResults.01 = 'itExam.088.100'] and (not(nem:eSituation.18[@PN])) and (not(nem:eSituation.18) or nem:eSituation.18 = '') and ../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-05-01T00:00:00'))">Date/Time Last Known Well NOT documented. Enter a value or select Unable to Complete. </sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eVitals.30 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup">
			<sch:let name="nemsisElements" value="nem:eVitals.30" />
			<sch:assert id="Rule_5017" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(../../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itExam.088'][nem:eCustomResults.01 = 'itExam.088.100'] and count(../../nem:eVitals.VitalGroup[(nem:eVitals.StrokeScaleGroup/nem:eVitals.30 and nem:eVitals.StrokeScaleGroup/nem:eVitals.30 != '')]) &lt; 1)">At least one Stroke Scale Type is required on all stroke patients.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>eVitals.29 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport/nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup">
			<sch:let name="nemsisElements" value="nem:eVitals.29" />
			<sch:assert id="Rule_5018" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not((nem:eVitals.30 = ('3330001') or ../../../nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'eVitals.30'][nem:eCustomResults.01 = ('it3330.104')]) and (not(nem:eVitals.29) or nem:eVitals.29 = '') and ../../../nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(../../../nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-05-01T00:00:00'))">Stroke Scale Score must be documented on all stroke patients. Pertinent Negatives and Not Values are NOT accepted.</sch:assert>
		</sch:rule>
	</sch:pattern>
	<!---->
	<sch:pattern>
		<sch:title>itVitals.096 related rule.</sch:title>
		<sch:rule context="nem:PatientCareReport">
			<sch:let name="nemsisElements" value="nem:itVitals.096" />
			<sch:assert id="Rule_5019" role="[WARNING]" diagnostics="nemsisDiagnostic" test="not(nem:eVitals/nem:eVitals.VitalGroup/nem:eVitals.StrokeScaleGroup/nem:eVitals.30 = ('3330013','3330007','3330009','3330021','3330023') and (not(nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itVitals.096']) or nem:eCustomResults/nem:eCustomResults.ResultsGroup[nem:eCustomResults.02 = 'itVitals.096'][nem:eCustomResults.01 = '']) and nem:eTimes/nem:eTimes.03 != '' and xs:dateTime(nem:eTimes/nem:eTimes.03) &gt; xs:dateTime('2025-05-01T00:00:00'))">Stroke Severity Score required on all stroke patients. </sch:assert>
		</sch:rule>
	</sch:pattern>

  <!-- DIAGNOSTICS -->

  <sch:diagnostics>

    <?DSDL_INCLUDE_START includes/diagnostic_nemsisDiagnostic.xml?><sch:diagnostic id="nemsisDiagnostic" xmlns:sch="http://purl.oclc.org/dsdl/schematron" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- This is the NEMSIS national diagnostic. It must exist in every NEMSIS Schematron document, 
       and it should be referenced by every assert and report. It provides nationally-
       standardized, structured data to communicate which data elements are of interest in a 
       failed assert or successful report. -->

  <nemsisDiagnostic xmlns="http://www.nemsis.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

    <!-- Elements that uniquely identify the record where the problem happened. -->

    <record>
      <xsl:copy-of select="ancestor-or-self::*:StateDataSet/*:sState/*:sState.01"/>
      <xsl:copy-of select="ancestor-or-self::*:DemographicReport/*:dAgency/(*:dAgency.01 | *:dAgency.02 | *:dAgency.04)"/>
      <xsl:copy-of select="ancestor-or-self::*:Header/*:DemographicGroup/*"/>
      <xsl:copy-of select="ancestor-or-self::*:PatientCareReport/*:eRecord/*:eRecord.01"/>
      <xsl:if test="ancestor-or-self::*[@UUID]">
        <UUID><xsl:value-of select="ancestor-or-self::*[@UUID][1]/@UUID"/></UUID>
      </xsl:if>
    </record>

    <!-- Elements that the user may want to revisit to resolve the problem, along with their values. -->

    <elements>
      <xsl:for-each select="$nemsisElements">
        <xsl:element name="element">
          <xsl:attribute name="location">
            <xsl:apply-templates select="." mode="schematron-get-full-path"/>
          </xsl:attribute>
          <xsl:for-each select="@*">
            <xsl:attribute name="{name()}">
              <xsl:value-of select="."/>
            </xsl:attribute>
          </xsl:for-each>
          <xsl:if test="not(*)">
            <xsl:value-of select="."/>
          </xsl:if>
        </xsl:element>
      </xsl:for-each>
    </elements>

    <!-- Elements that were missing, that the user may want to visit to resolve the problem. -->

    <elementsMissing>
      <xsl:variable name="default_context" select="."/>
      <xsl:for-each select="tokenize($nemsisElementsMissing, ' ')">
        <xsl:variable name="parent" select="$nemsisElementsMissingContext[contains(local-name(), substring-before(current(), '.'))][1]"/>
        <element>
          <xsl:attribute name="parentLocation">
            <xsl:choose>
              <xsl:when test="$parent">
                <xsl:apply-templates select="$parent" mode="schematron-get-full-path"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="$default_context" mode="schematron-get-full-path"/>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:attribute>
          <xsl:attribute name="name">
            <xsl:value-of select="."/>
          </xsl:attribute>
        </element>
      </xsl:for-each>
    </elementsMissing>

  </nemsisDiagnostic>

</sch:diagnostic><?DSDL_INCLUDE_END includes/diagnostic_nemsisDiagnostic.xml?>

  </sch:diagnostics>

</sch:schema>
