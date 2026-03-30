ALTER TABLE trip_records REPLICA IDENTITY FULL;

CREATE POLICY "realtime_trip_records"
ON trip_records
FOR SELECT
TO authenticated
USING (true);