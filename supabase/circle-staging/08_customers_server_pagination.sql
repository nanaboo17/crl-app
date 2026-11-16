-- Circle-safe server-side customer grouping/pagination.
-- Adds a new RPC without changing existing tables, RLS, or upload jobs.
CREATE OR REPLACE FUNCTION public.crl_superadmin_customers_page_v1(
 p_page integer DEFAULT 1,
 p_status text DEFAULT 'all',
 p_region text DEFAULT 'all',
 p_lead_email text DEFAULT 'all',
 p_search text DEFAULT ''
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor_circle uuid;
 actor_is_national boolean;
 result jsonb;
BEGIN
 SELECT a.circle_id, (a.circle_id IS NULL)
 INTO actor_circle, actor_is_national
 FROM public.agents a
 WHERE lower(a.email)=lower(auth.jwt()->>'email')
   AND a.role='superadmin' AND a.active IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Superadmin required' USING ERRCODE='42501'; END IF;
 IF p_page < 1 OR p_page > 100000 OR p_status NOT IN ('all','unassigned','assigned','visited','paid')
 THEN RAISE EXCEPTION 'Invalid customer page/filter'; END IF;
 WITH permitted AS MATERIALIZED (
  SELECT c.crl_id,c.customer_id,c.case_month,c.customer_name,c.phone_number,
         c.outstanding_amount,c.customer_status,c.visit_status,c.agent_email,
         c.lead_email,c.priority_rank,c.region,c.city,c.district,c.payment_status,
         c.assign_status,c.assignment_date,c.suspension_date,c.estimated_churn_date
  FROM public.customers c
  WHERE actor_is_national OR EXISTS (
   SELECT 1 FROM public.circle_regions cr
   JOIN public.circles ci ON ci.id=cr.circle_id AND ci.active IS TRUE
   WHERE cr.circle_id=actor_circle AND cr.region_code=upper(btrim(c.region))
  )
 ),
 grouped AS (
  SELECT customer_id,
   jsonb_agg(to_jsonb(x) ORDER BY x.case_month DESC NULLS LAST, x.crl_id DESC) AS cycles,
   (array_agg(to_jsonb(x) ORDER BY x.case_month DESC NULLS LAST,x.crl_id DESC))[1] AS latest,
   bool_or(agent_email IS NOT NULL) assigned,
   bool_or(agent_email IS NULL) unassigned,
   bool_or(lower(coalesce(customer_status,'')) LIKE '%visited%' OR lower(coalesce(visit_status,''))='visited') visited,
   bool_or(lower(coalesce(payment_status,''))='paid' OR lower(coalesce(customer_status,'')) LIKE '%paid%') paid,
   bool_or(
     (p_region='all' OR region=p_region)
     AND (p_lead_email='all' OR lead_email=p_lead_email)
     AND (CASE p_status
       WHEN 'assigned' THEN agent_email IS NOT NULL
       WHEN 'unassigned' THEN agent_email IS NULL
       WHEN 'visited' THEN lower(coalesce(customer_status,'')) LIKE '%visited%' OR lower(coalesce(visit_status,''))='visited'
       WHEN 'paid' THEN lower(coalesce(payment_status,''))='paid' OR lower(coalesce(customer_status,'')) LIKE '%paid%'
       ELSE TRUE END)
     AND (nullif(p_search,'') IS NULL OR
       lower(concat_ws(' ',crl_id,customer_id,customer_name,phone_number,agent_email,lead_email,region,city,district))
       LIKE '%'||lower(p_search)||'%')
   ) AS matches
  FROM permitted x WHERE nullif(btrim(customer_id),'') IS NOT NULL
  GROUP BY customer_id
 ),
 filtered AS (
  SELECT * FROM grouped WHERE matches
 ),
 numbered AS (
  SELECT customer_id,cycles,latest FROM filtered
  ORDER BY coalesce(latest->>'customer_name',customer_id), customer_id
  LIMIT 10 OFFSET (greatest(p_page,1)-1)*10
 )
 SELECT jsonb_build_object(
  'totalAll',(SELECT count(*) FROM grouped),
  'assigned',(SELECT count(*) FROM grouped WHERE assigned),
  'unassigned',(SELECT count(*) FROM grouped WHERE unassigned),
  'visited',(SELECT count(*) FROM grouped WHERE visited),
  'paid',(SELECT count(*) FROM grouped WHERE paid),
  'filteredTotal',(SELECT count(*) FROM filtered),
  'customers',coalesce((SELECT jsonb_agg(to_jsonb(numbered)) FROM numbered),'[]'::jsonb),
  'regions',coalesce((SELECT jsonb_agg(region ORDER BY region) FROM (SELECT DISTINCT btrim(region) region FROM permitted WHERE nullif(btrim(region),'') IS NOT NULL) d),'[]'::jsonb),
  'leadEmails',coalesce((SELECT jsonb_agg(lead_email ORDER BY lead_email) FROM (SELECT DISTINCT btrim(lead_email) lead_email FROM permitted WHERE nullif(btrim(lead_email),'') IS NOT NULL) d),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.crl_superadmin_customers_page_v1(integer,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crl_superadmin_customers_page_v1(integer,text,text,text,text) TO authenticated;