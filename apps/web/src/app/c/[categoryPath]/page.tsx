type Props = { params: { categoryPath: string } };

export default function CategoryPage({ params }: Props) {
  return (
    <div>
      <h1 className="text-xl font-semibold">Категория: {params.categoryPath}</h1>
      <p>Список объявлений в этой категории (скоро)</p>
    </div>
  );
}
