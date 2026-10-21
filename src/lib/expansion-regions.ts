/**
 * NCR expansion registry.
 *
 * IMPORTANT: these locations are expansion targets / waitlist only.
 * Do not add them to SERVICE_ZONES or treat them as bookable until
 * supplier/technician coverage, delivery economics, and DB dispatch
 * constraints have been validated for each locality.
 */
export type ExpansionRegion = {
  id: 'delhi' | 'noida' | 'ghaziabad';
  name: string;
  state: 'Delhi' | 'Uttar Pradesh';
  status: 'waitlist';
  coverageLabel: string;
  areas: readonly string[];
  notes: string;
};

export const NCR_EXPANSION_REGIONS: readonly ExpansionRegion[] = [
  {
    id: 'delhi',
    name: 'Delhi',
    state: 'Delhi',
    status: 'waitlist',
    coverageLabel: 'Delhi neighbourhoods and districts',
    areas: [
      'Central Delhi: Karol Bagh, Paharganj, Daryaganj, Civil Lines',
      'New Delhi: Connaught Place, Chanakyapuri, Parliament Street',
      'North Delhi: Model Town, Mukherjee Nagar, Timarpur',
      'North West Delhi: Rohini, Pitampura, Shalimar Bagh, Narela',
      'North East Delhi: Shahdara, Seelampur, Yamuna Vihar, Bhajanpura',
      'East Delhi: Preet Vihar, Laxmi Nagar, Mayur Vihar, Patparganj',
      'South Delhi: Saket, Malviya Nagar, Hauz Khas, Mehrauli',
      'South East Delhi: Lajpat Nagar, Kalkaji, Jasola, Sarita Vihar',
      'South West Delhi: Dwarka, Janakpuri, Vasant Kunj, Palam',
      'West Delhi: Rajouri Garden, Punjabi Bagh, Tilak Nagar, Paschim Vihar',
      'Outer Delhi: Najafgarh, Bawana, Mundka',
    ],
    notes: 'Neighbourhood names are discovery hints, not a promise of service availability.',
  },
  {
    id: 'noida',
    name: 'Noida & Greater Noida',
    state: 'Uttar Pradesh',
    status: 'waitlist',
    coverageLabel: 'Noida sectors and Greater Noida neighbourhoods',
    areas: [
      'Noida Sectors 1–12',
      'Noida Sectors 14–19 and 20–29',
      'Noida Sectors 30–49',
      'Noida Sectors 50–69',
      'Noida Sectors 70–89',
      'Noida Sectors 90–109',
      'Noida Sectors 110–129',
      'Noida Sectors 130–149',
      'Noida Sectors 150–168',
      'Noida Extension / Greater Noida West: Gaur City, Techzone, Bisrakh, Shahberi',
      'Greater Noida: Alpha, Beta, Gamma, Delta, Knowledge Park, Pari Chowk',
    ],
    notes: 'Sector groupings are broad discovery ranges; address-level validation is required. Sector 13 is intentionally omitted.',
  },
  {
    id: 'ghaziabad',
    name: 'Ghaziabad',
    state: 'Uttar Pradesh',
    status: 'waitlist',
    coverageLabel: 'Ghaziabad city, Loni and Modinagar corridor',
    areas: [
      'Indirapuram: Ahinsa Khand, Niti Khand, Shakti Khand, Vaibhav Khand',
      'Vaishali and Kaushambi',
      'Vasundhara: sectors and residential blocks',
      'Raj Nagar Extension',
      'Crossings Republik and Siddharth Vihar',
      'Sanjay Nagar, Kavi Nagar, Raj Nagar',
      'Old Ghaziabad, Nehru Nagar, Patel Nagar',
      'Loni and Tronica City',
      'Muradnagar and Modinagar',
    ],
    notes: 'District-wide locations are expansion candidates; actual launch boundaries must be confirmed operationally.',
  },
] as const;

export function getNcrExpansionRegion(idOrName: string): ExpansionRegion | undefined {
  const value = idOrName.trim().toLowerCase();
  return NCR_EXPANSION_REGIONS.find(
    (region) =>
      region.id === value ||
      region.name.toLowerCase() === value ||
      (region.id === 'noida' && ['noida', 'greater noida', 'noida extension', 'greater noida west'].includes(value)),
  );
}
