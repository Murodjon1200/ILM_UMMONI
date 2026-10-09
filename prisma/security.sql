CREATE OR REPLACE FUNCTION prevent_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Payments cannot be deleted. Update the payment status instead.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS payments_prevent_delete ON "Payment";

CREATE TRIGGER payments_prevent_delete
BEFORE DELETE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION prevent_payment_delete();
