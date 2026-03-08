import soapImg from '../assets/images/product-soap.png';
import scrubImg from '../assets/images/product-scrub.png';
import creamImg from '../assets/images/product-cream.png';
import tonerImg from '../assets/images/product-toner.png';

const products = [
  {
    id: 1,
    name: 'Botanical Cleansing Bar',
    category: 'Soap',
    price: '$24',
    image: soapImg,
  },
  {
    id: 2,
    name: 'Earthen Renewal Scrub',
    category: 'Scrub',
    price: '$48',
    image: scrubImg,
  },
  {
    id: 3,
    name: 'Deep Forest Moisture',
    category: 'Cream',
    price: '$65',
    image: creamImg,
  },
  {
    id: 4,
    name: 'Morning Dew Essence',
    category: 'Toner',
    price: '$38',
    image: tonerImg,
  }
];

export default function ProductGrid() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-background">
      <div className="text-center mb-16">
        <h2 className="font-serif text-4xl md:text-5xl text-primary mb-4">Curated Essentials</h2>
        <div className="w-16 h-0.5 bg-secondary mx-auto mb-6"></div>
        <p className="text-foreground/70 max-w-2xl mx-auto">
          Our introductory collection of earthen luxury. Each formulation is carefully 
          crafted to harmonize with your skin's natural balance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {products.map((product) => (
          <div key={product.id} className="group cursor-pointer">
            <div className="relative aspect-square mb-6 overflow-hidden bg-card">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                <button className="w-full bg-background/90 backdrop-blur text-primary py-3 text-sm uppercase tracking-wider font-medium hover:bg-primary hover:text-background transition-colors duration-300">
                  Quick Add
                </button>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-foreground/50 mb-2">{product.category}</p>
              <h3 className="font-serif text-xl text-primary mb-2 group-hover:text-secondary transition-colors duration-300">{product.name}</h3>
              <p className="text-sm font-medium">{product.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}