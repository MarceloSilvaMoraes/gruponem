ALTER TABLE public.inventory_transfers
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.equipment(id);

-- Helper function to safely process receipt and update stock balances
CREATE OR REPLACE FUNCTION process_transfer_receipt(transfer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t_row RECORD;
BEGIN
    SELECT * INTO t_row FROM public.inventory_transfers WHERE id = transfer_id;
    
    IF t_row.status = 'recebido' THEN
        RETURN; -- Already processed
    END IF;

    -- If it's a quantitative item
    IF t_row.item_id IS NOT NULL THEN
        -- Deduct from origin
        UPDATE public.stock_levels 
        SET quantity = GREATEST(0, quantity - t_row.quantity)
        WHERE item_id = t_row.item_id AND sector_id = t_row.origin_sector_id;
        
        -- Add to destination
        INSERT INTO public.stock_levels (item_id, sector_id, quantity)
        VALUES (t_row.item_id, t_row.destination_sector_id, t_row.quantity)
        ON CONFLICT (item_id, sector_id) 
        DO UPDATE SET quantity = stock_levels.quantity + t_row.quantity;
    END IF;

    -- If it's a specific equipment
    IF t_row.equipment_id IS NOT NULL THEN
        -- Mark the equipment
        UPDATE public.equipment 
        SET notes = CONCAT(notes, ' [Recebido via Logística: ', now(), ']') 
        WHERE id = t_row.equipment_id;
    END IF;

    -- Update transfer status
    UPDATE public.inventory_transfers 
    SET status = 'recebido', received_at = now() 
    WHERE id = transfer_id;
END;
$$;
